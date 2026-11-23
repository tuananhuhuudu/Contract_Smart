import { Injectable } from "@nestjs/common";
import { DataSource, type EntityManager } from "typeorm";
import { ContractTypeMilestone } from "../models/contract-type-milestone.entity";
import { ContractType } from "../models/contract-type.entity";
import { BaseRepository } from "./base.repository";

@Injectable()
export class ContractTypeRepository extends BaseRepository<ContractType, "id"> {
  protected readonly entity = ContractType;
  protected readonly idField = "id";
  protected readonly sortableFields = ["id", "name"] as const;
  protected readonly defaultSort = "id";

  constructor(dataSource: DataSource) {
    super(dataSource);
  }
}

@Injectable()
export class ContractTypeMilestoneRepository extends BaseRepository<ContractTypeMilestone, "id"> {
  protected readonly entity = ContractTypeMilestone;
  protected readonly idField = "id";
  protected readonly sortableFields = ["id", "position"] as const;
  protected readonly defaultSort = "position";
  protected override readonly allowDelete = true;

  constructor(dataSource: DataSource) {
    super(dataSource);
  }

  /** The template of a contract type, in order, with the library milestone of each row. */
  listByType(contractTypeId: number, db?: EntityManager): Promise<ContractTypeMilestone[]> {
    return this.repo(db).find({ where: { contractTypeId }, relations: { milestone: true }, order: { position: "ASC" } });
  }

  /** Numbers the rows 1, 2, 3... by due date (two steps, so the unique position never clashes). */
  async renumber(contractTypeId: number, db: EntityManager): Promise<void> {
    await db.query(`UPDATE contract_type_milestones SET position = position + 1000 WHERE contract_type_id = $1`, [contractTypeId]);
    await db.query(
      `UPDATE contract_type_milestones t SET position = o.n
         FROM (SELECT id, row_number() OVER (ORDER BY due_after_days, id) AS n FROM contract_type_milestones WHERE contract_type_id = $1) o
        WHERE t.id = o.id`,
      [contractTypeId],
    );
  }
}
