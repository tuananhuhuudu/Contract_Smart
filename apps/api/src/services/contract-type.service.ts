import { BadRequestException, Injectable } from "@nestjs/common";
import { DataSource, type EntityManager } from "typeorm";
import type { ContractType } from "../models/contract-type.entity";
import { definedOnly } from "../repositories/base.repository";
import { ContractTypeMilestoneRepository, ContractTypeRepository } from "../repositories/contract-type.repository";
import { MilestoneLibraryRepository, MilestoneVersionRepository } from "../repositories/milestone-library.repository";
import type {
  AddTemplateMilestoneDto,
  ContractTypeListQuery,
  UpdateTemplateMilestoneDto,
} from "../schemas/contract-type.schema";
import { sumPercents, toHundredths } from "../utils/money";
import type { Paginated } from "../utils/paging";
import { BaseService } from "./base.service";

export interface TemplateRow {
  id: number;
  version: number;
  position: number;
  milestoneId: number;
  milestoneName: string;
  /** Version a contract created now would get; null when the milestone has none published. */
  publishedVersionNo: number | null;
  paymentPercent: string;
  dueAfterDays: number;
}
export type ContractTypeDetail = Omit<ContractType, "milestones"> & { milestones: TemplateRow[]; totalPercent: string; complete: boolean };

/** Contract types and their templates (library milestones with a share of the value and a due offset). */
@Injectable()
export class ContractTypeService extends BaseService<ContractType, "id"> {
  constructor(
    repository: ContractTypeRepository,
    private readonly template: ContractTypeMilestoneRepository,
    private readonly library: MilestoneLibraryRepository,
    private readonly versions: MilestoneVersionRepository,
    private readonly dataSource: DataSource,
  ) {
    super(repository);
  }

  listTypes(query: ContractTypeListQuery): Promise<Paginated<ContractType>> {
    return this.repository.findPage({ ...query, order: query.sortBy ? query.order : "asc" },
      query.active === undefined ? {} : { active: query.active });
  }

  /** A contract type with its template; complete = the shares add up to exactly 100%. */
  async getType(id: number, db?: EntityManager): Promise<ContractTypeDetail> {
    const type = await this.repository.findById(id, db);
    const rows = await this.template.listByType(id, db);
    const milestones: TemplateRow[] = [];
    for (const row of rows) {
      const published = await this.versions.findPublished(row.milestoneId, db);
      milestones.push({
        id: row.id, version: row.version, position: row.position, milestoneId: row.milestoneId, milestoneName: row.milestone.name,
        publishedVersionNo: published?.versionNo ?? null, paymentPercent: row.paymentPercent, dueAfterDays: row.dueAfterDays,
      });
    }
    const totalPercent = sumPercents(rows.map((r) => r.paymentPercent));
    return { ...type, milestones, totalPercent, complete: totalPercent === "100.00" };
  }

  createType(name: string): Promise<ContractType> {
    return this.repository.create({ name: name.trim() });
  }

  /** Adds a library milestone that is active and has a published version; the shares may not exceed 100%. */
  addMilestone(contractTypeId: number, dto: AddTemplateMilestoneDto): Promise<ContractTypeDetail> {
    return this.dataSource.transaction(async (db) => {
      await this.repository.findById(contractTypeId, db);
      const milestone = await this.library.findById(dto.milestoneId, db);
      if (!milestone.active) throw new BadRequestException(`Milestone ${milestone.id} is not active`);
      if (!(await this.versions.findPublished(milestone.id, db)))
        throw new BadRequestException(`Milestone ${milestone.id} has no published version yet: publish its rules first`);
      const rows = await this.template.listByType(contractTypeId, db);
      this.assertTotal([...rows.map((r) => r.paymentPercent), dto.paymentPercent]);
      await this.template.create({ ...dto, contractTypeId, position: rows.length + 1 }, db);
      await this.template.renumber(contractTypeId, db);
      return this.getType(contractTypeId, db);
    });
  }

  updateMilestone(id: number, dto: UpdateTemplateMilestoneDto): Promise<ContractTypeDetail> {
    return this.dataSource.transaction(async (db) => {
      const row = await this.template.findById(id, db);
      const { version, ...sent } = dto;
      const changes = definedOnly(sent);
      if (changes.paymentPercent !== undefined) {
        const others = (await this.template.listByType(row.contractTypeId, db)).filter((r) => r.id !== id);
        this.assertTotal([...others.map((r) => r.paymentPercent), changes.paymentPercent]);
      }
      await this.template.update(id, version, changes, db);
      await this.template.renumber(row.contractTypeId, db);
      return this.getType(row.contractTypeId, db);
    });
  }

  removeMilestone(id: number, expectedVersion: number): Promise<ContractTypeDetail> {
    return this.dataSource.transaction(async (db) => {
      const row = await this.template.findById(id, db);
      await this.template.delete(id, expectedVersion, db);
      await this.template.renumber(row.contractTypeId, db);
      return this.getType(row.contractTypeId, db);
    });
  }

  private assertTotal(percents: string[]): void {
    const total = sumPercents(percents);
    if (toHundredths(total) > 10000n) throw new BadRequestException(`The shares would add up to ${total}%, more than 100%`);
  }
}
