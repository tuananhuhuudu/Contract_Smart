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
import type { ContractListQuery, CreateContractDto } from "../schemas/contract.schema";
import { addDays } from "../utils/dates";
import { splitByPercent, sumPercents } from "../utils/money";
import type { Paginated } from "../utils/paging";
import { BaseService } from "./base.service";

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
   * Approvals, grace and penalty rates are not copied: they follow from the contract (engine views).
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

      const id = await nextCode(db, "contracts", "contract_id", "CT", 4);
      await this.contracts.create({ ...dto, contractId: id, ruleVersionId: ruleVersion.id, lifecycle: "DRAFT" }, db);

      const amounts = splitByPercent(dto.contractValueVndMn, template.map((s) => s.paymentPercent));
      const ids = await nextCodes(db, "milestones", "milestone_id", "MS", 4, template.length);
      await this.milestones.createMany(
        template.map((stage, i) => ({
          milestoneId: ids[i]!,
          contractId: id,
          milestoneSequence: stage.sequence,
          milestoneName: stage.name,
          dueDate: addDays(dto.startDate, stage.offsetDays),
          plannedPaymentVndMn: amounts[i]!,
          requiredEventTypes: stage.requiredEventTypes,
          invoiceRequired: stage.invoiceRequired,
          latePenaltyApplicable: stage.latePenaltyApplicable,
          releaseRuleCode: stage.releaseRuleCode,
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
