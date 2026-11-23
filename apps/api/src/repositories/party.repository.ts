import { Injectable } from "@nestjs/common";
import { DataSource } from "typeorm";
import { Party } from "../models/party.entity";
import { BaseRepository } from "./base.repository";

@Injectable()
export class PartyRepository extends BaseRepository<Party, "id"> {
  protected readonly entity = Party;
  protected readonly idField = "id";
  protected readonly sortableFields = ["id", "name", "type"] as const;
  protected readonly defaultSort = "id";

  constructor(dataSource: DataSource) {
    super(dataSource);
  }
}
