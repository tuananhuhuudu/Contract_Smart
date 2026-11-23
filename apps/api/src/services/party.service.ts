import { Injectable } from "@nestjs/common";
import type { Party } from "../models/party.entity";
import { PartyRepository } from "../repositories/party.repository";
import type { PartyListQuery } from "../schemas/party.schema";
import type { Paginated } from "../utils/paging";
import { BaseService } from "./base.service";

/** Parties come from the Data Pack: read-only for now. */
@Injectable()
export class PartyService extends BaseService<Party, "partyId"> {
  constructor(repository: PartyRepository) {
    super(repository);
  }

  listParties(query: PartyListQuery): Promise<Paginated<Party>> {
    return this.repository.findPage(query, query.partyType ? { partyType: query.partyType } : {});
  }
}
