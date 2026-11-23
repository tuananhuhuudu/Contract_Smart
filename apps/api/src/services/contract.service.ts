import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { DataSource, type EntityManager } from "typeorm";
import type { Contract } from "../models/contract.entity";
import type { ContractTypeStage } from "../models/contract-type-stage.entity";
import type { Milestone } from "../models/milestone.entity";
import { nextCode, nextCodes } from "../repositories/codes";
import { ContractRepository, MilestoneRepository } from "../repositories/contract.repository";
import { ContractTypeStageRepository } from "../repositories/contract-type-stage.repository";
import { ContractTypeRepository } from "../repositories/contract-type.repository";
import { PartyRepository } from "../repositories/party.repository";
import { RuleVersionRepository } from "../repositories/rule.repository";
import type { ApprovalPolicy, ContractListQuery, CreateContractDto } from "../schemas/contract.schema";
import { addDays } from "../utils/dates";
import { splitByPercent, sumPercents } from "../utils/money";
import type { Paginated } from "../utils/paging";
import { BaseService } from "./base.service";

/** Approver roles each approval policy needs (Data Pack convention). */
const APPROVAL_ROLES: Record<ApprovalPolicy, string[]> = {
  AUTO_IF_ALL_CONDITIONS: [],
  SINGLE_BUYER_APPROVAL: ["CONTRACT_OWNER"],
  DUAL_APPROVAL: ["CONTRACT_OWNER", "SECONDARY_APPROVER"],
  FINANCE_PLUS_OWNER: ["CONTRACT_OWNER", "FINANCE_APPROVER"],
};

/** Human-readable condition of a milestone, as in milestones.csv: EVENT:DELIVERY AND ... AND NO_OPEN_DISPUTE. */
function conditionText(events: readonly string[], quorum: number): string {
  const parts = events.map((event) => `EVENT:${event}`);
  if (quorum > 0) parts.push(`APPROVALS>=${quorum}`);
  return [...parts, "NO_OPEN_DISPUTE"].join(" AND ");
}

@Injectable()
export class ContractService extends BaseService<Contract, "contractId"> {
  constructor(
    private readonly contracts: ContractRepository,
    private readonly milestones: MilestoneRepository,
    private readonly types: ContractTypeRepository,
    private readonly stages: ContractTypeStageRepository,
    private readonly parties: PartyRepository,
    private readonly ruleVersions: RuleVersionRepository,
    private readonly dataSource: DataSource,
  ) {
    super(contracts);
  }

  listContracts(query: ContractListQuery): Promise<Paginated<Contract>> {
    const where = {
      ...(query.contractType ? { contractType: query.contractType } : {}),
      ...(query.lifecycle ? { lifecycle: query.lifecycle } : {}),
      ...(query.buyerId ? { buyerId: query.buyerId } : {}),
      ...(query.supplierId ? { supplierId: query.supplierId } : {}),
    };
    return this.contracts.findPage(query, where);
  }

  async getDetail(contractId: string): Promise<Contract> {
    const contract = await this.contracts.findDetail(contractId);
    if (!contract) throw new NotFoundException(`Contract ${contractId} not found`);
    return contract;
  }

  async listMilestones(contractId: string): Promise<Milestone[]> {
    await this.contracts.findById(contractId);
    return this.milestones.listByContract(contractId);
  }

  getMilestone(milestoneId: string): Promise<Milestone> {
    return this.milestones.findById(milestoneId);
  }

  /**
   * Creates a DRAFT contract and generates its milestones from the type's template, in one
   * transaction: amount = share of the value (the last stage takes the rounding remainder), due
   * date = start + offset, rule set copied from the stage, rule version = the one in use today.
   */
  async createContract(dto: CreateContractDto): Promise<Contract> {
    const contractId = await this.dataSource.transaction(async (db) => {
      const type = await this.types.findById(dto.contractType, db);
      if (!type.active) throw new BadRequestException(`Contract type ${type.code} is not active`);
      const template = await this.stages.listByType(type.code, db);
      this.assertTemplate(type.code, template);
      await this.assertParty(dto.buyerId, "BUYER", db);
      await this.assertParty(dto.supplierId, "SUPPLIER", db);
      if (!(dto.signingDate <= dto.startDate && dto.startDate <= dto.endDate))
        throw new BadRequestException("Dates must satisfy signingDate <= startDate <= endDate");
      const ruleVersion = await this.ruleVersions.findCurrent(db);
      if (!ruleVersion) throw new BadRequestException("No published rule version: publish one before creating contracts");

      const policy = dto.approvalPolicy;
      const roles = APPROVAL_ROLES[policy];
      const id = await nextCode(db, "contracts", "contract_id", "CT", 4);
      await this.contracts.create(
        {
          ...dto,
          contractId: id,
          workflowTemplate: type.workflowTemplate,
          ruleSetId: type.ruleSetId,
          ruleVersionId: ruleVersion.id,
          approvalQuorum: roles.length,
          autoReleaseAllowed: dto.autoReleaseAllowed ?? policy === "AUTO_IF_ALL_CONDITIONS",
          lifecycle: "DRAFT",
          dataIsSynthetic: false,
        },
        db,
      );

      const amounts = splitByPercent(dto.contractValueVndMn, template.map((s) => s.paymentPercent));
      const ids = await nextCodes(db, "milestones", "milestone_id", "MS", 4, template.length);
      await this.milestones.createMany(
        template.map((stage, i) => ({
          milestoneId: ids[i]!,
          contractId: id,
          milestoneSequence: stage.sequence,
          milestoneType: stage.milestoneType,
          milestoneName: stage.name,
          dueDate: addDays(dto.startDate, stage.offsetDays),
          paymentPercent: stage.paymentPercent,
          plannedPaymentVndMn: amounts[i]!,
          requiredEventTypes: stage.requiredEventTypes,
          requiredCondition: conditionText(stage.requiredEventTypes, roles.length),
          invoiceRequired: stage.invoiceRequired,
          approvalRequired: roles.length > 0,
          requiredApprovalQuorum: roles.length,
          requiredApprovalRoles: roles,
          latePenaltyApplicable: stage.latePenaltyApplicable,
          gracePeriodDays: dto.gracePeriodDays,
          // A stage without late penalties carries no penalty rate, as in the Data Pack.
          penaltyRatePctPerDay: stage.latePenaltyApplicable ? dto.penaltyRatePctPerDay : "0",
          maxPenaltyPct: stage.latePenaltyApplicable ? dto.maxPenaltyPct : "0",
          releaseRuleCode: stage.releaseRuleCode,
          dataIsSynthetic: false,
        })),
        db,
      );
      return id;
    });
    return this.getDetail(contractId);
  }

  /** A template must exist and add up to exactly 100%. */
  private assertTemplate(code: string, template: ContractTypeStage[]): void {
    if (template.length === 0) throw new BadRequestException(`Contract type ${code} has no stages`);
    const total = sumPercents(template.map((s) => s.paymentPercent));
    if (total !== "100.00") throw new BadRequestException(`Stages of ${code} add up to ${total}%, not 100%`);
  }

  private async assertParty(partyId: string, type: "BUYER" | "SUPPLIER", db: EntityManager) {
    const party = await this.parties.findByIdOptional(partyId, db);
    if (!party || party.partyType !== type) throw new BadRequestException(`${partyId} is not a ${type.toLowerCase()}`);
    if (party.status !== "ACTIVE") throw new BadRequestException(`${partyId} is not active`);
  }
}
