import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, IsUUID } from "class-validator";
import { AUDIT_ACTIONS } from "../models/audit-log.entity";
import { ListQueryDto } from "./base.schema";

/** GET /audit-log */
export class AuditListQuery extends ListQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() contractId?: number;
  @IsOptional() @IsIn(AUDIT_ACTIONS) action?: (typeof AUDIT_ACTIONS)[number];
  @IsOptional() @IsString() resource?: string;
  @IsOptional() @IsUUID() actorId?: string;
}
