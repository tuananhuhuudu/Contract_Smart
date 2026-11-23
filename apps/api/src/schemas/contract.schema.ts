import { Transform, Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Length, Matches, Max, Min } from "class-validator";
import { APPROVAL_POLICIES, CONTRACT_STATUSES } from "../models/contract.entity";
import { ListQueryDto } from "./base.schema";
import { DECIMAL_2, ISO_DATE, VersionedDto } from "./common.schema";
import { PERCENT } from "./contract-type.schema";

/** Up to 4 decimals: penalty rates such as "0.1000". */
const RATE = /^\d{1,3}(\.\d{1,4})?$/;

/** POST /contracts: a contract created from the template of its type (status DRAFT). */
export class CreateContractDto {
  @IsString() @Length(1, 300) title!: string;
  @Type(() => Number) @IsInt() contractTypeId!: number;
  @Type(() => Number) @IsInt() buyerId!: number;
  @Type(() => Number) @IsInt() supplierId!: number;
  /** "1000.00" = 1 tỷ đồng */
  @Matches(DECIMAL_2) valueVndMn!: string;
  @Matches(ISO_DATE) startOn!: string;
  @Matches(ISO_DATE) endOn!: string;
  @IsIn(APPROVAL_POLICIES) approvalPolicy!: (typeof APPROVAL_POLICIES)[number];
  @Type(() => Number) @IsInt() @Min(0) @Max(365) graceDays!: number;
  /** "0.1" = 0,1 % per day */
  @Matches(RATE) penaltyPctPerDay!: string;
  @Matches(RATE) maxPenaltyPct!: string;
}

/** PATCH /contracts/:id (DRAFT only). A new value rescales the milestone amounts; a new start shifts their due dates. */
export class UpdateContractDto extends VersionedDto {
  @IsOptional() @IsString() @Length(1, 300) title?: string;
  @IsOptional() @Type(() => Number) @IsInt() buyerId?: number;
  @IsOptional() @Type(() => Number) @IsInt() supplierId?: number;
  @IsOptional() @Matches(DECIMAL_2) valueVndMn?: string;
  @IsOptional() @Matches(ISO_DATE) startOn?: string;
  @IsOptional() @Matches(ISO_DATE) endOn?: string;
  @IsOptional() @IsIn(APPROVAL_POLICIES) approvalPolicy?: (typeof APPROVAL_POLICIES)[number];
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(365) graceDays?: number;
  @IsOptional() @Matches(RATE) penaltyPctPerDay?: string;
  @IsOptional() @Matches(RATE) maxPenaltyPct?: string;
}

/** GET /contracts?status=ACTIVE&contractTypeId=1 */
export class ContractListQuery extends ListQueryDto {
  @IsOptional() @IsIn(CONTRACT_STATUSES) status?: (typeof CONTRACT_STATUSES)[number];
  @IsOptional() @Type(() => Number) @IsInt() contractTypeId?: number;
  @IsOptional() @Type(() => Number) @IsInt() buyerId?: number;
  @IsOptional() @Type(() => Number) @IsInt() supplierId?: number;
}

/** POST /contracts/:id/milestones: a library milestone added to this contract only. */
export class AddContractMilestoneDto {
  @Type(() => Number) @IsInt() milestoneId!: number;
  @Matches(PERCENT) paymentPercent!: string;
  @Matches(ISO_DATE) dueOn!: string;
}

/** PATCH /milestones/:id (DRAFT contract only) */
export class UpdateContractMilestoneDto extends VersionedDto {
  @IsOptional() @Matches(PERCENT) paymentPercent?: string;
  @IsOptional() @Matches(ISO_DATE) dueOn?: string;
}

/** POST /events */
export class CreateEventDto {
  @Type(() => Number) @IsInt() milestoneId!: number;
  @Type(() => Number) @IsInt() eventTypeId!: number;
  /** "2026-06-05T09:50:00"; now (Vietnam time) when left out. */
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/) happenedAt?: string;
  @IsOptional() @IsString() @Length(1, 100) @Transform(({ value }) => (typeof value === "string" ? value.trim() : value)) documentNo?: string;
  /** Only for closing a dispute: the opening event it closes. */
  @IsOptional() @Type(() => Number) @IsInt() resolvesEventId?: number;
  @IsOptional() @IsString() @Length(0, 1000) note?: string;
}
