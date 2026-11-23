import { Injectable } from "@nestjs/common";
import type { Party } from "../models/party.entity";
import { PartyRepository } from "../repositories/party.repository";
import type { PartyListQuery } from "../schemas/party.schema";
import type { Paginated } from "../utils/paging";
import { BaseService } from "./base.service";

/** Parties are loaded by the seed script; read-only in the API for now. */
@Injectable()
export class PartyService extends BaseService<Party, "id"> {
  constructor(repository: PartyRepository) {
    super(repository);
  }

  listParties(query: PartyListQuery): Promise<Paginated<Party>> {
    return this.repository.findPage(query, query.type ? { type: query.type } : {});
  }
}
