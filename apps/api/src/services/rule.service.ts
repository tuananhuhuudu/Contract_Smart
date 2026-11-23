import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { DataSource, type EntityManager } from "typeorm";
import { ContractTypeStage } from "../models/contract-type-stage.entity";
import { ContractType } from "../models/contract-type.entity";
import type { PaymentRule } from "../models/payment-rule.entity";
import type { RuleScope } from "../models/rule-scope.entity";
import type { RuleVersion } from "../models/rule-version.entity";
import { nextCode } from "../repositories/codes";
import { PaymentRuleRepository, RuleScopeRepository, RuleVersionRepository } from "../repositories/rule.repository";
import type {
  CreatePaymentRuleDto,
  CreateRuleScopeDto,
  CreateRuleVersionDto,
  PaymentRuleListQuery,
  RuleScopeListQuery,
  UpdatePaymentRuleDto,
} from "../schemas/rule.schema";
import { FALLBACK_CONDITION } from "../schemas/rule.schema";
import type { ListQueryDto } from "../schemas/base.schema";
import type { Paginated } from "../utils/paging";

/** Rule sets, rule versions and the rules inside them. */
@Injectable()
export class RuleService {
  constructor(
    private readonly scopes: RuleScopeRepository,
    private readonly versions: RuleVersionRepository,
    private readonly rules: PaymentRuleRepository,
    private readonly dataSource: DataSource,
  ) {}

  // ---------- rule scopes ----------

  listScopes(query: RuleScopeListQuery): Promise<Paginated<RuleScope>> {
    return this.scopes.findPage(query, query.contractType ? { contractType: query.contractType } : {});
  }

  getScope(code: string): Promise<RuleScope> {
    return this.scopes.findById(code);
  }

  async createScope(dto: CreateRuleScopeDto): Promise<RuleScope> {
    const type = await this.dataSource.getRepository(ContractType).findOneBy({ code: dto.contractType });
    if (!type) throw new BadRequestException(`Contract type ${dto.contractType} does not exist`);
    // Keep the organiser's naming: <rule set of the type>:<milestone type>.
    const expected = `${type.ruleSetId}:${dto.milestoneType}`;
    if (dto.releaseRuleCode !== expected)
      throw new BadRequestException(`releaseRuleCode must be ${expected} for ${dto.contractType} / ${dto.milestoneType}`);
    return this.scopes.create(dto);
  }

  renameScope(code: string, version: number, name: string): Promise<RuleScope> {
    return this.scopes.update(code, version, { name });
  }

  // ---------- rule versions ----------

  listVersions(query: ListQueryDto): Promise<Paginated<RuleVersion>> {
    return this.versions.findPage(query);
  }

  async getVersion(id: string): Promise<RuleVersion & { ruleCount: number }> {
    const version = await this.versions.findById(id);
    return { ...version, ruleCount: await this.rules.count({ ruleVersionId: id }) };
  }

  async currentVersion(): Promise<RuleVersion> {
    const current = await this.versions.findCurrent();
    if (!current) throw new NotFoundException("No published rule version yet");
    return current;
  }

  /** A new DRAFT version; its rules start as a copy of `copyFrom` (default: the version in use). */
  async createVersion(dto: CreateRuleVersionDto): Promise<RuleVersion & { ruleCount: number }> {
    return this.dataSource.transaction(async (db) => {
      if (await this.versions.exists({ id: dto.id }, db)) throw new ConflictException(`Rule version ${dto.id} already exists`);
      const source =
        dto.copyFrom === "" ? null : dto.copyFrom ? await this.versions.findById(dto.copyFrom, db) : await this.versions.findCurrent(db);
      const version = await this.versions.create({ id: dto.id, name: dto.name, note: dto.note ?? null, status: "DRAFT" }, db);
      let ruleCount = 0;
      if (source) {
        const copies = (await this.rules.listByVersion(source.id, db)).map((rule) => {
          // Drop the key, the version link and the bookkeeping columns; keep the rule's content.
          const { ruleId, ruleVersionId: _from, origin: _origin, version: _version, createdAt: _created, updatedAt: _updated, ...content } = rule;
          // PR0015 in v1 becomes PR0015-v2: the copy keeps its lineage in the id.
          return { ...content, ruleId: `${ruleId.split("-")[0]}-${dto.id}`, ruleVersionId: dto.id };
        });
        ruleCount = await this.rules.createMany(copies, db);
      }
      return { ...version, ruleCount };
    });
  }

  /**
   * Publishes a DRAFT: checks it is complete, retires the version in use, and freezes this one.
   * New contracts then use it; existing contracts keep their version.
   */
  async publishVersion(id: string, expectedVersion: number): Promise<RuleVersion> {
    return this.dataSource.transaction(async (db) => {
      const draft = await this.versions.findById(id, db);
      if (draft.status !== "DRAFT") throw new ConflictException(`Rule version ${id} is ${draft.status}, not DRAFT`);
      this.assertComplete(await this.rules.listByVersion(id, db), await this.scopesInUse(db));
      const current = await this.versions.findCurrent(db);
      if (current) await this.versions.update(current.id, current.version, { status: "RETIRED" }, db);
      return this.versions.update(id, expectedVersion, { status: "PUBLISHED", publishedAt: new Date() }, db);
    });
  }

  /** Rule sets used by the templates of active contract types: each needs rules before publishing. */
  private async scopesInUse(db: EntityManager): Promise<string[]> {
    const stages = await db
      .getRepository(ContractTypeStage)
      .createQueryBuilder("s")
      .innerJoin(ContractType, "t", "t.code = s.contract_type AND t.active")
      .select("DISTINCT s.release_rule_code", "code")
      .getRawMany<{ code: string }>();
    return stages.map((s) => s.code);
  }

  /** Every rule set used by a template has rules, and every rule set ends with an active ELSE rule. */
  private assertComplete(rules: PaymentRule[], scopesInUse: string[]): void {
    const bySet = new Map<string, PaymentRule[]>();
    for (const rule of rules.filter((r) => r.active)) bySet.set(rule.releaseRuleCode, [...(bySet.get(rule.releaseRuleCode) ?? []), rule]);
    const problems: string[] = [];
    for (const code of scopesInUse) if (!bySet.has(code)) problems.push(`${code}: no rules`);
    for (const [code, list] of bySet) {
      const last = list.at(-1);
      if (last?.conditionExpression.trim().toUpperCase() !== FALLBACK_CONDITION)
        problems.push(`${code}: the last rule must be "${FALLBACK_CONDITION}"`);
    }
    if (problems.length) throw new BadRequestException(`Rule version is not complete: ${problems.join("; ")}`);
  }

  // ---------- payment rules ----------

  listRules(query: PaymentRuleListQuery): Promise<Paginated<PaymentRule>> {
    const where = {
      ...(query.ruleVersionId ? { ruleVersionId: query.ruleVersionId } : {}),
      ...(query.releaseRuleCode ? { releaseRuleCode: query.releaseRuleCode } : {}),
    };
    return this.rules.findPage({ ...query, order: query.sortBy ? query.order : "asc" }, where);
  }

  getRule(ruleId: string): Promise<PaymentRule> {
    return this.rules.findById(ruleId);
  }

  /** A new rule in a DRAFT version; the columns that describe its rule set are copied from it. */
  async createRule(dto: CreatePaymentRuleDto): Promise<PaymentRule> {
    return this.dataSource.transaction(async (db) => {
      const version = await this.versions.findById(dto.ruleVersionId, db);
      if (version.status !== "DRAFT") throw new ConflictException(`Rule version ${version.id} is ${version.status}; rules can only be added to a DRAFT`);
      const scope = await this.scopes.findById(dto.releaseRuleCode, db);
      const type = await db.getRepository(ContractType).findOneByOrFail({ code: scope.contractType });
      return this.rules.create(
        {
          ...dto,
          ruleId: await nextCode(db, "payment_rules", "rule_id", "PR", 4),
          ruleSetId: type.ruleSetId,
          workflowTemplate: type.workflowTemplate,
          contractType: type.code,
          appliesToMilestoneType: scope.milestoneType,
          parameterSource: dto.parameterSource ?? "milestones, events",
          dataIsSynthetic: false,
        },
        db,
      );
    });
  }

  updateRule(ruleId: string, dto: UpdatePaymentRuleDto): Promise<PaymentRule> {
    const { version, ...changes } = dto;
    return this.rules.update(ruleId, version, changes);
  }

  removeRule(ruleId: string, version: number): Promise<void> {
    return this.rules.delete(ruleId, version);
  }
}
