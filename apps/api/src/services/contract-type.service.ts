import { BadRequestException, Injectable } from "@nestjs/common";
import { DataSource, type EntityManager } from "typeorm";
import type { ContractType } from "../models/contract-type.entity";
import type { ContractTypeStage } from "../models/contract-type-stage.entity";
import { RuleScope } from "../models/rule-scope.entity";
import { ContractTypeRepository } from "../repositories/contract-type.repository";
import { ContractTypeStageRepository } from "../repositories/contract-type-stage.repository";
import type { ContractTypeListQuery, CreateStageDto, UpdateStageDto } from "../schemas/contract-type.schema";
import { sumPercents } from "../utils/money";
import type { Paginated } from "../utils/paging";
import { BaseService } from "./base.service";

/** A contract type with its template and whether the template is complete. */
export interface ContractTypeDetail extends ContractType {
  stages: ContractTypeStage[];
  /** Sum of the stage percentages, as a decimal string. */
  percentTotal: string;
  /** True when the stages add up to exactly 100%: only then can contracts of this type be created. */
  templateComplete: boolean;
}

@Injectable()
export class ContractTypeService extends BaseService<ContractType, "code"> {
  constructor(
    repository: ContractTypeRepository,
    private readonly stages: ContractTypeStageRepository,
    private readonly dataSource: DataSource,
  ) {
    super(repository);
  }

  listTypes(query: ContractTypeListQuery): Promise<Paginated<ContractType>> {
    return this.repository.findPage(query, query.active === undefined ? {} : { active: query.active });
  }

  async getDetail(code: string): Promise<ContractTypeDetail> {
    const type = await this.repository.findById(code);
    const stages = await this.stages.listByType(code);
    const percentTotal = sumPercents(stages.map((s) => s.paymentPercent));
    return { ...type, stages, percentTotal, templateComplete: percentTotal === "100.00" };
  }

  listStages(code: string): Promise<ContractTypeStage[]> {
    return this.repository.findById(code).then(() => this.stages.listByType(code));
  }

  async addStage(code: string, dto: CreateStageDto): Promise<ContractTypeStage> {
    return this.dataSource.transaction(async (db) => {
      await this.repository.findById(code, db);
      await this.assertRuleScopeOfType(code, dto.releaseRuleCode, db);
      await this.assertPercentFits(code, null, dto.paymentPercent, db);
      return this.stages.create({ ...dto, contractType: code }, db);
    });
  }

  async updateStage(code: string, sequence: number, dto: UpdateStageDto): Promise<ContractTypeStage> {
    const { version, ...changes } = dto;
    return this.dataSource.transaction(async (db) => {
      if (changes.releaseRuleCode) await this.assertRuleScopeOfType(code, changes.releaseRuleCode, db);
      if (changes.paymentPercent) await this.assertPercentFits(code, sequence, changes.paymentPercent, db);
      return this.stages.update(code, sequence, version, changes, db);
    });
  }

  removeStage(code: string, sequence: number, version: number): Promise<void> {
    return this.stages.delete(code, sequence, version);
  }

  /** A stage may only use a rule set that exists and belongs to the same contract type. */
  private async assertRuleScopeOfType(code: string, releaseRuleCode: string, db: EntityManager) {
    const scope = await db.getRepository(RuleScope).findOneBy({ releaseRuleCode });
    if (!scope) throw new BadRequestException(`Rule set ${releaseRuleCode} does not exist`);
    if (scope.contractType !== code)
      throw new BadRequestException(`Rule set ${releaseRuleCode} belongs to ${scope.contractType}, not ${code}`);
  }

  /** The stages of a type may never add up to more than 100%. */
  private async assertPercentFits(
    code: string,
    replacedSequence: number | null,
    percent: string,
    db: EntityManager,
  ) {
    const others = (await this.stages.listByType(code, db)).filter((s) => s.sequence !== replacedSequence);
    const total = sumPercents([...others.map((s) => s.paymentPercent), percent]);
    if (Number(total) > 100) throw new BadRequestException(`Stages of ${code} would add up to ${total}%, more than 100%`);
  }
}
