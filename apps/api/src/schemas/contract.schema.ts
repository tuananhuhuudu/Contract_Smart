import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Length, Matches, Max, Min } from "class-validator";
import { ListQueryDto } from "./base.schema";
import { CODE, DECIMAL_2, ISO_DATE } from "./common.schema";

export const APPROVAL_POLICIES = ["AUTO_IF_ALL_CONDITIONS", "SINGLE_BUYER_APPROVAL", "DUAL_APPROVAL", "FINANCE_PLUS_OWNER"] as const;
export type ApprovalPolicy = (typeof APPROVAL_POLICIES)[number];
export const LIFECYCLES = ["DRAFT", "SIGNING", "ACTIVE", "CLOSED"] as const;

/**
 * POST /contracts: a DRAFT contract; its milestones are generated from the type's template.
 * buyerId is taken from the request until sign-in exists; it will come from the signed-in user.
 */
export class CreateContractDto {
  @IsString()
  @Length(1, 300)
  contractTitle!: string;

  /** GOODS_SUPPLY */
  @Matches(CODE)
  contractType!: string;

  /** B009 */
  @IsString()
  buyerId!: string;

  /** S021 */
  @IsString()
  supplierId!: string;

  /** Contract value in VND million: "1290" */
  @Matches(DECIMAL_2)
  contractValueVndMn!: string;

  /** 2026-04-12 */
  @Matches(ISO_DATE)
  signingDate!: string;

  @Matches(ISO_DATE)
  startDate!: string;

  @Matches(ISO_DATE)
  endDate!: string;

  /** The number of approvers and their roles follow from it. */
  @IsIn(APPROVAL_POLICIES)
  approvalPolicy!: ApprovalPolicy;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(365)
  gracePeriodDays!: number;

  /** "0.10" (% per day) */
  @Matches(DECIMAL_2)
  penaltyRatePctPerDay!: string;

  /** "10" (% cap) */
  @Matches(DECIMAL_2)
  maxPenaltyPct!: string;
}

/** GET /contracts?contractType=GOODS_SUPPLY&lifecycle=ACTIVE&buyerId=B009 */
export class ContractListQuery extends ListQueryDto {
  @IsOptional()
  @Matches(CODE)
  contractType?: string;

  @IsOptional()
  @IsIn(LIFECYCLES)
  lifecycle?: (typeof LIFECYCLES)[number];

  @IsOptional()
  @IsString()
  buyerId?: string;

  @IsOptional()
  @IsString()
  supplierId?: string;
}
