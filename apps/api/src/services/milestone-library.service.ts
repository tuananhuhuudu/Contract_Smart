import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { DataSource, In, type EntityManager } from "typeorm";
import { EventType } from "../models/event-type.entity";
import type { MilestoneLibrary } from "../models/milestone-library.entity";
import type { MilestoneVersion } from "../models/milestone-version.entity";
import type { PaymentRule } from "../models/payment-rule.entity";
import { definedOnly } from "../repositories/base.repository";
import {
  MilestoneLibraryRepository,
  MilestoneVersionRepository,
  PaymentRuleRepository,
} from "../repositories/milestone-library.repository";
import type {
  CreateMilestoneDto,
  CreateRuleDto,
  MilestoneListQuery,
  UpdateRuleDto,
  UpdateVersionDto,
} from "../schemas/milestone-library.schema";
import type { Paginated } from "../utils/paging";
import { PAYABLE_ONLY_VARIABLES, unknownWords } from "../utils/rule-language";
import { BaseService } from "./base.service";

export type MilestoneDetail = MilestoneLibrary & { versions: MilestoneVersion[] };
export type VersionDetail = MilestoneVersion & { rules: PaymentRule[] };

/**
 * The milestone library: milestones, their versions (conditions + rules) and the rules themselves.
 * Only drafts change; the database locks a version once it is published (trigger), and this
 * service gives the same answer earlier with a clearer message.
 */
@Injectable()
export class MilestoneLibraryService extends BaseService<MilestoneLibrary, "id"> {
  constructor(
    repository: MilestoneLibraryRepository,
    private readonly versions: MilestoneVersionRepository,
    private readonly rules: PaymentRuleRepository,
    private readonly dataSource: DataSource,
  ) {
    super(repository);
  }

  // ---------------- Milestones ----------------

  listMilestones(query: MilestoneListQuery): Promise<Paginated<MilestoneLibrary>> {
    return this.repository.findPage({ ...query, order: query.sortBy ? query.order : "asc" },
      query.active === undefined ? {} : { active: query.active });
  }

  async getMilestone(id: number): Promise<MilestoneDetail> {
    const milestone = await this.repository.findById(id);
    return { ...milestone, versions: await this.versions.listShared(id) };
  }

  /** A new milestone always starts with draft v1, empty or copied from another milestone's published version. */
  createMilestone(dto: CreateMilestoneDto): Promise<MilestoneDetail> {
    return this.dataSource.transaction(async (db) => {
      const source = dto.copyFromMilestoneId === undefined ? null : await this.publishedOrFail(dto.copyFromMilestoneId, db);
      const milestone = await this.repository.create({ name: dto.name.trim() }, db);
      await this.copyVersion(source, { milestoneId: milestone.id, versionNo: 1, isCustom: false }, db);
      return { ...milestone, versions: await this.versions.listShared(milestone.id, db) };
    });
  }

  // ---------------- Versions ----------------

  async getVersion(id: number, db?: EntityManager): Promise<VersionDetail> {
    const version = await this.versions.findById(id, db);
    return { ...version, rules: await this.rules.listByVersion(id, db) };
  }

  /** Next shared draft of a milestone, copied from the version in use (or the latest one). One draft at a time. */
  createVersion(milestoneId: number): Promise<VersionDetail> {
    return this.dataSource.transaction(async (db) => {
      await this.repository.findById(milestoneId, db);
      const all = await this.versions.listShared(milestoneId, db);
      const draft = all.find((v) => v.status === "DRAFT");
      if (draft) throw new ConflictException(`DRAFT_EXISTS: milestone ${milestoneId} already has draft v${draft.versionNo} (id ${draft.id})`);
      const base = all.find((v) => v.status === "PUBLISHED") ?? all.at(-1) ?? null;
      const created = await this.copyVersion(base, { milestoneId, versionNo: (all.at(-1)?.versionNo ?? 0) + 1, isCustom: false }, db);
      return this.getVersion(created.id, db);
    });
  }

  updateVersion(id: number, dto: UpdateVersionDto): Promise<VersionDetail> {
    return this.dataSource.transaction(async (db) => {
      await this.draftOrFail(id, db);
      if (dto.requiredEventTypeIds) await this.assertEvidenceTypes(dto.requiredEventTypeIds, db);
      const { version, ...changes } = dto;
      await this.versions.update(id, version, changes, db);
      return this.getVersion(id, db);
    });
  }

  /** Checks the draft is complete, retires the shared version in use and locks this one. */
  publishVersion(id: number, expectedVersion: number): Promise<VersionDetail> {
    return this.dataSource.transaction(async (db) => {
      const draft = await this.draftOrFail(id, db);
      if (draft.isCustom) throw new ConflictException("CUSTOM_VERSION: a contract's own rules are locked when the contract is activated");
      const problems = this.completeness(draft, await this.rules.listByVersion(id, db));
      if (problems.length) throw new BadRequestException(`Version is not complete: ${problems.join("; ")}`);
      const current = await this.versions.findPublished(draft.milestoneId, db);
      if (current) await this.versions.update(current.id, current.version, { status: "RETIRED" }, db);
      await this.versions.update(id, expectedVersion, { status: "PUBLISHED", publishedAt: new Date() }, db);
      return this.getVersion(id, db);
    });
  }

  // ---------------- Rules ----------------

  addRule(versionId: number, dto: CreateRuleDto): Promise<PaymentRule> {
    return this.dataSource.transaction(async (db) => {
      await this.draftOrFail(versionId, db);
      this.assertRuleWords(dto);
      return this.rules.create({ ...dto, name: dto.name.trim(), condition: dto.condition.trim(), milestoneVersionId: versionId }, db);
    });
  }

  updateRule(id: number, dto: UpdateRuleDto): Promise<PaymentRule> {
    return this.dataSource.transaction(async (db) => {
      const rule = await this.rules.findById(id, db);
      await this.draftOrFail(rule.milestoneVersionId, db);
      const { version, ...sent } = dto;
      const changes = definedOnly(sent);
      this.assertRuleWords({ ...rule, ...changes });
      return this.rules.update(id, version, changes, db);
    });
  }

  removeRule(id: number, expectedVersion: number): Promise<void> {
    return this.dataSource.transaction(async (db) => {
      const rule = await this.rules.findById(id, db);
      await this.draftOrFail(rule.milestoneVersionId, db);
      await this.rules.delete(id, expectedVersion, db);
    });
  }

  // ---------------- Helpers ----------------

  /** What a version still lacks before it can be published (empty when complete). */
  completeness(version: MilestoneVersion, rules: PaymentRule[]): string[] {
    const problems: string[] = [];
    if (!version.requiredEventTypeIds.length) problems.push("no required event types");
    if (!rules.length) problems.push("no rules");
    else if (rules.at(-1)!.condition.trim() !== "ELSE") problems.push("the last rule (highest priority) must be ELSE");
    return problems;
  }

  /** Copies conditions and rules of `source` (or nothing) into a new draft. */
  private async copyVersion(source: MilestoneVersion | null, target: Pick<MilestoneVersion, "milestoneId" | "versionNo" | "isCustom">, db: EntityManager) {
    const created = await this.versions.create({
      ...target, status: "DRAFT",
      requiredEventTypeIds: source?.requiredEventTypeIds ?? [], latePenalty: source?.latePenalty ?? false,
      note: source ? `Chép từ phiên bản id ${source.id}` : null,
    }, db);
    if (source) {
      const rules = await this.rules.listByVersion(source.id, db);
      await this.rules.createMany(rules.map(({ priority, name, condition, decision, reasonCode, payableFormula, penaltyFormula }) =>
        ({ milestoneVersionId: created.id, priority, name, condition, decision, reasonCode, payableFormula, penaltyFormula })), db);
    }
    return created;
  }

  private async publishedOrFail(milestoneId: number, db: EntityManager): Promise<MilestoneVersion> {
    const published = await this.versions.findPublished(milestoneId, db);
    if (!published) throw new NotFoundException(`Milestone ${milestoneId} has no published version to copy`);
    return published;
  }

  private async draftOrFail(id: number, db: EntityManager): Promise<MilestoneVersion> {
    const version = await this.versions.findById(id, db);
    if (version.status !== "DRAFT")
      throw new ConflictException(`MILESTONE_VERSION_LOCKED: version ${id} is ${version.status}, create a new version to change it`);
    return version;
  }

  /** Required events must be active evidence types: approvals, disputes and the like are counted by the engine, not required. */
  private async assertEvidenceTypes(ids: number[], db: EntityManager): Promise<void> {
    const found = await db.getRepository(EventType).find({ where: { id: In(ids), active: true, category: "EVIDENCE" } });
    const ok = new Set(found.map((t) => t.id));
    const bad = ids.filter((id) => !ok.has(id));
    if (bad.length) throw new BadRequestException(`Not active evidence event types: ${bad.join(", ")}`);
  }

  private assertRuleWords(rule: Pick<PaymentRule, "condition"> & Partial<Pick<PaymentRule, "payableFormula" | "penaltyFormula">>): void {
    const unknown = [
      ...unknownWords(rule.condition),
      ...unknownWords(rule.payableFormula ?? "0", PAYABLE_ONLY_VARIABLES),
      ...unknownWords(rule.penaltyFormula ?? "0"),
    ];
    if (unknown.length) throw new BadRequestException(`Unknown words in the rule (the engine cannot compute them): ${[...new Set(unknown)].join(", ")}`);
  }
}
