import { Injectable } from "@nestjs/common";
import { DataSource } from "typeorm";
import { Party } from "../models/party.entity";
import { BaseRepository } from "./base.repository";

@Injectable()
export class PartyRepository extends BaseRepository<Party, "partyId"> {
  protected readonly entity = Party;
  protected readonly idField = "partyId";
  protected readonly sortableFields = ["partyId", "partyName", "partyType", "region"] as const;
  protected readonly defaultSort = "partyId";

  constructor(dataSource: DataSource) {
    super(dataSource);
  }
}
