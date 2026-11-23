import { Injectable } from "@nestjs/common";
import { DataSource } from "typeorm";
import { ContractType } from "../models/contract-type.entity";
import { BaseRepository } from "./base.repository";

@Injectable()
export class ContractTypeRepository extends BaseRepository<ContractType, "code"> {
  protected readonly entity = ContractType;
  protected readonly idField = "code";
  protected readonly sortableFields = ["code", "name", "createdAt"] as const;
  protected readonly defaultSort = "code";

  constructor(dataSource: DataSource) {
    super(dataSource);
  }
}
