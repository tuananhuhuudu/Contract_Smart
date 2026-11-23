import { Injectable } from "@nestjs/common";
import { DataSource, type EntityManager } from "typeorm";
import { Contract } from "../models/contract.entity";
import { Milestone } from "../models/milestone.entity";
import { BaseRepository } from "./base.repository";

@Injectable()
export class ContractRepository extends BaseRepository<Contract, "contractId"> {
  protected readonly entity = Contract;
  protected readonly idField = "contractId";
  protected readonly sortableFields = ["contractId", "contractTitle", "signingDate", "contractValueVndMn", "createdAt"] as const;
  protected readonly defaultSort = "contractId";

  constructor(dataSource: DataSource) {
    super(dataSource);
  }

  /** A contract with its type, parties and milestones (in order). */
  findDetail(contractId: string, db?: EntityManager): Promise<Contract | null> {
    return this.repo(db).findOne({
      where: { contractId },
      relations: { type: true, buyer: true, supplier: true, ruleVersion: true, milestones: true },
      order: { milestones: { milestoneSequence: "ASC" } },
    });
  }
}

@Injectable()
export class MilestoneRepository extends BaseRepository<Milestone, "milestoneId"> {
  protected readonly entity = Milestone;
  protected readonly idField = "milestoneId";
  protected readonly sortableFields = ["milestoneId", "dueDate", "plannedPaymentVndMn"] as const;
  protected readonly defaultSort = "milestoneId";

  constructor(dataSource: DataSource) {
    super(dataSource);
  }

  listByContract(contractId: string, db?: EntityManager): Promise<Milestone[]> {
    return this.repo(db).find({ where: { contractId }, order: { milestoneSequence: "ASC" } });
  }
}
