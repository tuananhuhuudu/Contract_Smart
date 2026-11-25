import { BadRequestException, ConflictException, ForbiddenException, Injectable } from "@nestjs/common";
import { DataSource, type EntityManager } from "typeorm";
import type { Contract } from "../models/contract.entity";
import { MilestoneVersion } from "../models/milestone-version.entity";
import { Party, type PartyType } from "../models/party.entity";
import { definedOnly } from "../repositories/base.repository";
import { ContractRepository, MilestoneRepository } from "../repositories/contract.repository";
import { ContractTypeMilestoneRepository, ContractTypeRepository } from "../repositories/contract-type.repository";
import {
  MilestoneLibraryRepository,
  MilestoneVersionRepository,
  PaymentRuleRepository,
} from "../repositories/milestone-library.repository";
import type {
  AddContractMilestoneDto,
  ContractListQuery,
  CreateContractDto,
  UpdateContractDto,
  UpdateContractMilestoneDto,
} from "../schemas/contract.schema";
import { addDays } from "../utils/dates";
import { assertBuyerStaff, assertCanSee, NEGOTIATORS, organizationOf, SEES_ALL } from "../core/security/access";
import type { AuthUser } from "../core/security/decorators";
import { percentOf, rescale, shareOf, splitByPercent, sumAmounts } from "../utils/money";
import type { Paginated } from "../utils/paging";
import { BaseService } from "./base.service";
import { AuditService } from "./audit.service";
import { EngineService } from "./engine.service";
import { PaymentService } from "./payment.service";
import { MilestoneLibraryService } from "./milestone-library.service";

export interface MilestoneRow {
  id: number;
  version: number;
  position: number;
  /** Library milestone and its name. */
  milestoneId: number;
  name: string;
  milestoneVersionId: number;
  versionNo: number;
  /** TRUE: rules made for this contract only. */
  isCustom: boolean;
  versionStatus: string;
  amountVndMn: string;
  paymentPercent: string;
  dueOn: string;
  requiredEventTypeIds: number[];
  latePenalty: boolean;
  ruleCount: number;
  /** The newest engine decision for this milestone; null before activation. */
  evaluation: {
    id: number; decision: string; reasonCode: string; milestoneStatus: string; payableVndMn: string; penaltyVndMn: string;
    ruleId: number | null; triggerEventId: number | null; evaluatedAt: Date;
  } | null;
  /** The milestone's payment order: PENDING (waiting for the finance approver) or PAID; null if none. */
  payment: { id: number; version: number; status: string; amountVndMn: string; penaltyVndMn: string; paidAt: Date | null; gatewayRef: string | null } | null;
}
export type ContractDetail = Omit<Contract, "milestones"> & {
  milestones: MilestoneRow[];
  /** Sum of the milestone amounts; the contract can be activated only when it equals the value. */
  totalAmountVndMn: string;
  complete: boolean;
};

const daysBetween = (from: string, to: string): number => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

/**
 * Contracts and their real milestones. A contract is created from the template of its type and stays
 * DRAFT while it is negotiated: terms, shares, due dates, milestones and per-milestone rules can change
 * for this customer only. Activating it checks it is complete and locks everything (triggers).
 */
@Injectable()
export class ContractService extends BaseService<Contract, "id"> {
  constructor(
    repository: ContractRepository,
    private readonly milestones: MilestoneRepository,
    private readonly types: ContractTypeRepository,
    private readonly template: ContractTypeMilestoneRepository,
    private readonly library: MilestoneLibraryRepository,
    private readonly versions: MilestoneVersionRepository,
    private readonly rules: PaymentRuleRepository,
    private readonly libraryService: MilestoneLibraryService,
    private readonly engine: EngineService,
    private readonly payments: PaymentService,
    private readonly audit: AuditService,
    private readonly dataSource: DataSource,
  ) {
    super(repository);
  }

  // ---------------- Contracts ----------------

  /** Contracts the user may see: all of them for SYSTEM_ADMIN and AUDITOR, otherwise those of their organisation. */
  async listContracts(query: ContractListQuery, user: AuthUser): Promise<Paginated<Contract>> {
    const where = definedOnly({ status: query.status, contractTypeId: query.contractTypeId, buyerId: query.buyerId, supplierId: query.supplierId });
    if (SEES_ALL.includes(user.role)) return this.repository.findPage(query, where);
    const org = await organizationOf(user, this.dataSource.manager);
    if (org === null) return this.repository.findPage(query, { ...where, id: -1 });
    return this.repository.findPage(query, [{ ...where, buyerId: org }, { ...where, supplierId: org }]);
  }

  /** One contract, if the user may see it. */
  async getContractFor(id: number, user: AuthUser): Promise<ContractDetail> {
    const contract = await this.repository.findById(id);
    await assertCanSee(user, contract, this.dataSource.manager);
    return this.getContract(id);
  }

  async getContract(id: number, db?: EntityManager): Promise<ContractDetail> {
    const contract = await this.repository.findById(id, db);
    const rows: MilestoneRow[] = [];
    const list = await this.milestones.listByContract(id, db);
    const latest = await this.engine.latest(list.map((m) => m.id), db);
    const orders = await this.payments.current(list.map((m) => m.id), db);
    for (const m of list) {
      const e = latest.get(m.id);
      const p = orders.get(m.id);
      const v = m.milestoneVersion;
      rows.push({
        id: m.id, version: m.version, position: m.position, milestoneId: v.milestoneId, name: v.milestone.name,
        milestoneVersionId: v.id, versionNo: v.versionNo, isCustom: v.isCustom, versionStatus: v.status,
        amountVndMn: m.amountVndMn, paymentPercent: percentOf(m.amountVndMn, contract.valueVndMn), dueOn: m.dueOn,
        requiredEventTypeIds: v.requiredEventTypeIds, latePenalty: v.latePenalty, ruleCount: (await this.rules.listByVersion(v.id, db)).length,
        evaluation: e ? { id: e.id, decision: e.decision, reasonCode: e.reasonCode, milestoneStatus: e.milestoneStatus, payableVndMn: e.payableVndMn,
          penaltyVndMn: e.penaltyVndMn, ruleId: e.ruleId, triggerEventId: e.triggerEventId, evaluatedAt: e.evaluatedAt } : null,
        payment: p ? { id: p.id, version: p.version, status: p.status, amountVndMn: p.amountVndMn, penaltyVndMn: p.penaltyVndMn, paidAt: p.paidAt, gatewayRef: p.gatewayRef } : null,
      });
    }
    const totalAmountVndMn = sumAmounts(rows.map((r) => r.amountVndMn));
    return { ...contract, milestones: rows, totalAmountVndMn, complete: rows.length > 0 && totalAmountVndMn === contract.valueVndMn };
  }

  /** New DRAFT contract: the type must be active and its template complete (100%) with published milestones. */
  createContract(dto: CreateContractDto, user: AuthUser): Promise<ContractDetail> {
    return this.dataSource.transaction(async (db) => {
      if ((await organizationOf(user, db)) !== dto.buyerId)
        throw new ForbiddenException("CONTRACT_ACCESS_DENIED: you can only create contracts where your organisation is the buyer");
      const type = await this.types.findById(dto.contractTypeId, db);
      if (!type.active) throw new BadRequestException(`Contract type ${type.id} is not active`);
      const template = await this.template.listByType(type.id, db);
      if (!template.length) throw new BadRequestException(`Contract type ${type.id} has no milestones`);
      const total = sumAmounts(template.map((t) => t.paymentPercent));
      if (total !== "100.00") throw new BadRequestException(`The milestones of contract type ${type.id} add up to ${total}%, not 100%`);
      const versionIds: number[] = [];
      for (const t of template) {
        const published = await this.versions.findPublished(t.milestoneId, db);
        if (!published) throw new BadRequestException(`Milestone "${t.milestone.name}" has no published version`);
        versionIds.push(published.id);
      }
      await this.assertParties(dto.buyerId, dto.supplierId, db);
      this.assertDates(dto.startOn, dto.endOn);

      const contract = await this.repository.create({ ...dto, title: dto.title.trim(), status: "DRAFT" }, db);
      const amounts = splitByPercent(dto.valueVndMn, template.map((t) => t.paymentPercent));
      await this.milestones.createMany(template.map((t, i) => ({
        contractId: contract.id, position: t.position, milestoneVersionId: versionIds[i],
        amountVndMn: amounts[i], dueOn: addDays(dto.startOn, t.dueAfterDays),
      })), db);
      await this.audit.record(db, user, {
        action: "CONTRACT_CREATED", resource: "contract", resourceId: contract.id, contractId: contract.id,
        after: { title: contract.title, contractTypeId: type.id, buyerId: dto.buyerId, supplierId: dto.supplierId, valueVndMn: dto.valueVndMn,
          startOn: dto.startOn, endOn: dto.endOn, approvalPolicy: contract.approvalPolicy, milestones: template.length },
      });
      return this.getContract(contract.id, db);
    });
  }

  /** Terms of a draft. A new value rescales the amounts in proportion; a new start shifts every due date by the same days. */
  updateContract(id: number, dto: UpdateContractDto, user: AuthUser): Promise<ContractDetail> {
    return this.dataSource.transaction(async (db) => {
      const contract = await this.draftOrFail(id, db, user);
      const { version, ...sent } = dto;
      const changes = definedOnly(sent);
      if (changes.title !== undefined) changes.title = changes.title.trim();
      await this.assertParties(changes.buyerId ?? contract.buyerId, changes.supplierId ?? contract.supplierId, db);
      this.assertDates(changes.startOn ?? contract.startOn, changes.endOn ?? contract.endOn);
      await this.repository.update(id, version, changes, db);

      const rows = await this.milestones.listByContract(id, db);
      if (changes.valueVndMn !== undefined && changes.valueVndMn !== contract.valueVndMn && rows.length) {
        const amounts = rescale(rows.map((m) => m.amountVndMn), sumAmounts(rows.map((m) => m.amountVndMn)), changes.valueVndMn);
        for (const [i, m] of rows.entries()) await this.milestones.update(m.id, m.version, { amountVndMn: amounts[i] }, db);
      }
      const shift = changes.startOn === undefined ? 0 : daysBetween(contract.startOn, changes.startOn);
      if (shift) for (const m of await this.milestones.listByContract(id, db)) await this.milestones.update(m.id, m.version, { dueOn: addDays(m.dueOn, shift) }, db);
      const old = contract as unknown as Record<string, unknown>;
      const changed = Object.keys(changes).filter((k) => old[k] !== (changes as Record<string, unknown>)[k]);
      if (changed.length)
        await this.audit.record(db, user, {
          action: "CONTRACT_UPDATED", resource: "contract", resourceId: id, contractId: id,
          before: Object.fromEntries(changed.map((k) => [k, old[k]])), after: Object.fromEntries(changed.map((k) => [k, (changes as Record<string, unknown>)[k]])),
        });
      return this.getContract(id, db);
    });
  }

  /** DRAFT -> ACTIVE: milestones add up to the value, the parties are valid and every custom rule set is complete. */
  activate(id: number, expectedVersion: number, user: AuthUser): Promise<ContractDetail> {
    return this.dataSource.transaction(async (db) => {
      const detail = await this.getContract(id, db);
      await assertBuyerStaff(user, detail as unknown as Contract, ["CONTRACT_OWNER"], db);
      if (detail.status !== "DRAFT") throw new ConflictException(`CONTRACT_STATUS: contract ${id} is ${detail.status}, only a draft can be activated`);
      if (!detail.milestones.length) throw new BadRequestException("The contract has no milestones");
      if (!detail.complete)
        throw new BadRequestException(`Milestones add up to ${detail.totalAmountVndMn}, the contract value is ${detail.valueVndMn}`);
      await this.assertParties(detail.buyerId, detail.supplierId, db);
      const custom = detail.milestones.filter((m) => m.isCustom);
      const problems: string[] = [];
      for (const m of custom) {
        const v = await this.versions.findById(m.milestoneVersionId, db);
        const missing = this.libraryService.completeness(v, await this.rules.listByVersion(v.id, db));
        if (missing.length) problems.push(`${m.name}: ${missing.join(", ")}`);
      }
      if (problems.length) throw new BadRequestException(`Custom rules are not complete: ${problems.join("; ")}`);
      // Lock the contract's own rules together with the contract.
      for (const m of custom) {
        const v = await this.versions.findById(m.milestoneVersionId, db);
        await this.versions.update(v.id, v.version, { status: "PUBLISHED", publishedAt: new Date() }, db);
      }
      await this.repository.update(id, expectedVersion, { status: "ACTIVE" }, db);
      await this.audit.record(db, user, {
        action: "CONTRACT_ACTIVATED", resource: "contract", resourceId: id, contractId: id,
        before: { status: "DRAFT" }, after: { status: "ACTIVE", valueVndMn: detail.valueVndMn, milestones: detail.milestones.length, customRules: custom.map((m) => m.name) },
      });
      // First decision of every milestone (usually "waiting for evidence").
      await this.engine.evaluateQuietly(id, {}, db);
      return this.getContract(id, db);
    });
  }

  // ---------------- Milestones of a draft contract ----------------

  /** Adds a library milestone to this contract only, with its current published rules. */
  addMilestone(contractId: number, dto: AddContractMilestoneDto, user: AuthUser): Promise<ContractDetail> {
    return this.dataSource.transaction(async (db) => {
      const contract = await this.draftOrFail(contractId, db, user);
      const milestone = await this.library.findById(dto.milestoneId, db);
      if (!milestone.active) throw new BadRequestException(`Milestone ${milestone.id} is not active`);
      const published = await this.versions.findPublished(milestone.id, db);
      if (!published) throw new BadRequestException(`Milestone ${milestone.id} has no published version yet`);
      const rows = await this.milestones.listByContract(contractId, db);
      if (rows.some((m) => m.milestoneVersion.milestoneId === milestone.id))
        throw new ConflictException(`Milestone "${milestone.name}" is already in this contract`);
      const added = await this.milestones.create({
        contractId, position: rows.length + 1, milestoneVersionId: published.id,
        amountVndMn: shareOf(contract.valueVndMn, dto.paymentPercent), dueOn: dto.dueOn,
      }, db);
      await this.audit.record(db, user, {
        action: "MILESTONE_ADDED", resource: "milestone", resourceId: added.id, contractId,
        after: { name: milestone.name, amountVndMn: added.amountVndMn, dueOn: dto.dueOn },
      });
      await this.milestones.renumber(contractId, db);
      return this.getContract(contractId, db);
    });
  }

  /** Share (given as a percentage, stored as money) or due date of one milestone of a draft. */
  updateMilestone(id: number, dto: UpdateContractMilestoneDto, user: AuthUser): Promise<ContractDetail> {
    return this.dataSource.transaction(async (db) => {
      const milestone = await this.milestones.findById(id, db);
      const contract = await this.draftOrFail(milestone.contractId, db, user);
      const changes = definedOnly({
        amountVndMn: dto.paymentPercent === undefined ? undefined : shareOf(contract.valueVndMn, dto.paymentPercent),
        dueOn: dto.dueOn,
      });
      await this.milestones.update(id, dto.version, changes, db);
      const old = milestone as unknown as Record<string, unknown>;
      await this.audit.record(db, user, {
        action: "MILESTONE_UPDATED", resource: "milestone", resourceId: id, contractId: contract.id,
        before: Object.fromEntries(Object.keys(changes).map((k) => [k, old[k]])), after: changes,
      });
      await this.milestones.renumber(contract.id, db);
      return this.getContract(contract.id, db);
    });
  }

  /** Removes a milestone from a draft, and its custom rules if it had some. */
  removeMilestone(id: number, expectedVersion: number, user: AuthUser): Promise<ContractDetail> {
    return this.dataSource.transaction(async (db) => {
      const milestone = await this.milestones.findById(id, db);
      await this.draftOrFail(milestone.contractId, db, user);
      const version = await this.versions.findById(milestone.milestoneVersionId, db);
      await this.milestones.delete(id, expectedVersion, db);
      await this.audit.record(db, user, {
        action: "MILESTONE_REMOVED", resource: "milestone", resourceId: id, contractId: milestone.contractId,
        before: { milestoneVersionId: version.id, amountVndMn: milestone.amountVndMn, dueOn: milestone.dueOn, customRules: version.isCustom },
      });
      if (version.isCustom) await db.getRepository(MilestoneVersion).delete(version.id);
      await this.milestones.renumber(milestone.contractId, db);
      return this.getContract(milestone.contractId, db);
    });
  }

  /** Gives one milestone its own rules: a draft copy of the rules it uses now, edited through the milestone-version API. */
  useCustomRules(id: number, user: AuthUser): Promise<ContractDetail> {
    return this.dataSource.transaction(async (db) => {
      const milestone = await this.milestones.findById(id, db);
      await this.draftOrFail(milestone.contractId, db, user);
      const current = await this.versions.findById(milestone.milestoneVersionId, db);
      if (current.isCustom) throw new ConflictException(`Milestone ${id} already has its own rules (version ${current.id})`);
      const copy = await this.libraryService.createCustomCopy(current.id, db);
      await this.milestones.update(id, milestone.version, { milestoneVersionId: copy.id }, db);
      await this.audit.record(db, user, {
        action: "MILESTONE_CUSTOM_RULES", resource: "milestone", resourceId: id, contractId: milestone.contractId,
        before: { milestoneVersionId: current.id }, after: { milestoneVersionId: copy.id },
      });
      return this.getContract(milestone.contractId, db);
    });
  }

  /** Back to the shared rules in use in the library; the contract's own draft rules are dropped. */
  useSharedRules(id: number, user: AuthUser): Promise<ContractDetail> {
    return this.dataSource.transaction(async (db) => {
      const milestone = await this.milestones.findById(id, db);
      await this.draftOrFail(milestone.contractId, db, user);
      const custom = await this.versions.findById(milestone.milestoneVersionId, db);
      if (!custom.isCustom) throw new ConflictException(`Milestone ${id} already uses the shared rules`);
      const published = await this.versions.findPublished(custom.milestoneId, db);
      if (!published) throw new BadRequestException(`Milestone ${custom.milestoneId} has no published shared version`);
      await this.milestones.update(id, milestone.version, { milestoneVersionId: published.id }, db);
      await this.audit.record(db, user, {
        action: "MILESTONE_SHARED_RULES", resource: "milestone", resourceId: id, contractId: milestone.contractId,
        before: { milestoneVersionId: custom.id }, after: { milestoneVersionId: published.id },
      });
      await db.getRepository(MilestoneVersion).delete(custom.id);
      return this.getContract(milestone.contractId, db);
    });
  }

  // ---------------- Helpers ----------------

  /** The contract, if it is still a draft and the user negotiates it for the buyer. */
  private async draftOrFail(id: number, db: EntityManager, user: AuthUser): Promise<Contract> {
    const contract = await this.repository.findById(id, db);
    await assertBuyerStaff(user, contract, NEGOTIATORS, db);
    if (contract.status !== "DRAFT")
      throw new ConflictException(`CONTRACT_LOCKED: contract ${id} is ${contract.status}; only a draft can change`);
    return contract;
  }

  private async assertParties(buyerId: number, supplierId: number, db: EntityManager): Promise<void> {
    await this.assertParty(buyerId, "BUYER", db);
    await this.assertParty(supplierId, "SUPPLIER", db);
  }

  private async assertParty(id: number, type: PartyType, db: EntityManager): Promise<void> {
    const party = await db.getRepository(Party).findOne({ where: { id } });
    if (!party || party.type !== type) throw new BadRequestException(`Party ${id} is not a ${type.toLowerCase()}`);
    if (!party.active) throw new BadRequestException(`Party ${id} is not active`);
  }

  private assertDates(startOn: string, endOn: string): void {
    if (startOn > endOn) throw new BadRequestException("startOn must not be after endOn");
  }
}

