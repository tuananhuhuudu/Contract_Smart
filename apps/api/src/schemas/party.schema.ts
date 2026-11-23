import { IsIn, IsOptional } from "class-validator";
import { ListQueryDto } from "./base.schema";

export const PARTY_TYPES = ["BUYER", "SUPPLIER", "APPROVER"] as const;

/** GET /parties?partyType=SUPPLIER */
export class PartyListQuery extends ListQueryDto {
  @IsOptional()
  @IsIn(PARTY_TYPES)
  partyType?: (typeof PARTY_TYPES)[number];
}
