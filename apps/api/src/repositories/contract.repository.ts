import { Injectable } from "@nestjs/common";
import { DataSource, type EntityManager } from "typeorm";
import { Contract } from "../models/contract.entity";
import { Milestone } from "../models/milestone.entity";
import { BaseRepository } from "./base.repository";

@Injectable()
export class ContractRepository extends BaseRepository<Contract, "id"> {
  protected readonly entity = Contract;
  protected readonly idField = "id";
  protected readonly sortableFields = ["id", "title", "startOn", "valueVndMn", "status"] as const;
  protected readonly defaultSort = "id";

  constructor(dataSource: DataSource) {
    super(dataSource);
  }
}

@Injectable()
export class MilestoneRepository extends BaseRepository<Milestone, "id"> {
  protected readonly entity = Milestone;
  protected readonly idField = "id";
  protected readonly sortableFields = ["id", "position", "dueOn"] as const;
  protected readonly defaultSort = "position";
  // Only while the contract is a draft; the database refuses it afterwards.
  protected override readonly allowDelete = true;

  constructor(dataSource: DataSource) {
    super(dataSource);
  }

  /** Milestones of a contract in order, each with its version and library milestone. */
  listByContract(contractId: number, db?: EntityManager): Promise<Milestone[]> {
    return this.repo(db).find({
      where: { contractId }, relations: { milestoneVersion: { milestone: true } }, order: { position: "ASC" },
    });
  }

  /** Numbers the milestones 1, 2, 3... by due date (two steps, so the unique position never clashes). */
  async renumber(contractId: number, db: EntityManager): Promise<void> {
    await db.query(`UPDATE milestones SET position = position + 1000 WHERE contract_id = $1`, [contractId]);
    await db.query(
      `UPDATE milestones t SET position = o.n
         FROM (SELECT id, row_number() OVER (ORDER BY due_on, id) AS n FROM milestones WHERE contract_id = $1) o
        WHERE t.id = o.id`,
      [contractId],
    );
  }
}
