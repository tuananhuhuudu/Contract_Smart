import { IsIn, IsOptional } from "class-validator";
import { PARTY_TYPES } from "../models/party.entity";
import { ListQueryDto } from "./base.schema";

/** GET /parties?type=SUPPLIER */
export class PartyListQuery extends ListQueryDto {
  @IsOptional()
  @IsIn(PARTY_TYPES)
  type?: (typeof PARTY_TYPES)[number];
}
