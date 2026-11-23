import { PartialType, PickType } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Length, Matches, Min } from "class-validator";
import { ListQueryDto } from "./base.schema";
import { CODE, RULE_SCOPE_CODE } from "./common.schema";

export const RULE_GROUPS = ["BLOCKING", "VALIDATION", "PENALTY", "RELEASE", "FALLBACK"] as const;
export const DECISIONS = ["RELEASE", "HOLD", "REJECT", "PENALTY"] as const;
/** Condition of the last rule of every rule set: whatever is left is held for a person to check. */
export const FALLBACK_CONDITION = "ELSE";

// ---------- rule scopes (rule sets) ----------

/** POST /rule-scopes */
export class CreateRuleScopeDto {
  /** R_GOODS_STD:DELIVERY */
  @Matches(RULE_SCOPE_CODE)
  releaseRuleCode!: string;

  /** GOODS_SUPPLY */
  @Matches(CODE)
  contractType!: string;

  /** DELIVERY */
  @Matches(CODE)
  milestoneType!: string;

  /** Giao hàng - hàng hóa */
  @IsString()
  @Length(1, 200)
  name!: string;
}

/** PATCH /rule-scopes/:code: only the display name; the codes are referenced by stages and milestones. */
export class UpdateRuleScopeDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version!: number;

  @IsString()
  @Length(1, 200)
  name!: string;
}

/** GET /rule-scopes?contractType=GOODS_SUPPLY */
export class RuleScopeListQuery extends ListQueryDto {
  @IsOptional()
  @Matches(CODE)
  contractType?: string;
}

// ---------- rule versions ----------

/** POST /rule-versions: a new DRAFT, by default a copy of the version in use. */
export class CreateRuleVersionDto {
  /** v2 */
  @Matches(/^[a-z0-9][a-z0-9_.-]*$/)
  @Length(1, 40)
  id!: string;

  @IsString()
  @Length(1, 200)
  name!: string;

  @IsOptional()
  @IsString()
  @Length(0, 2000)
  note?: string;

  /** Version to copy the rules from; default: the version currently published. "" = start empty. */
  @IsOptional()
  @IsString()
  copyFrom?: string;
}

// ---------- payment rules ----------

/** POST /payment-rules: a rule in a DRAFT version; it gets the next PR code. */
export class CreatePaymentRuleDto {
  @IsString()
  ruleVersionId!: string;

  @Matches(RULE_SCOPE_CODE)
  releaseRuleCode!: string;

  /** 10, 20, ... smaller is evaluated first */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  priority!: number;

  @IsString()
  @Length(1, 200)
  ruleName!: string;

  @IsIn(RULE_GROUPS)
  ruleGroup!: (typeof RULE_GROUPS)[number];

  /** open_dispute == TRUE, or ELSE for the last rule */
  @IsString()
  @Length(1, 1000)
  conditionExpression!: string;

  @IsIn(DECISIONS)
  decision!: (typeof DECISIONS)[number];

  /** OPEN_DISPUTE */
  @Matches(CODE)
  reasonCode!: string;

  /** planned_payment_vnd_mn, or 0 */
  @IsString()
  @Length(1, 1000)
  payableAmountFormula!: string;

  @IsString()
  @Length(1, 1000)
  penaltyAmountFormula!: string;

  @IsString()
  @Length(1, 2000)
  ruleDescriptionVi!: string;
}

/** PATCH /payment-rules/:ruleId: only while its version is a DRAFT (the database refuses otherwise). */
export class UpdatePaymentRuleDto extends PartialType(
  PickType(CreatePaymentRuleDto, [
    "priority",
    "ruleName",
    "ruleGroup",
    "conditionExpression",
    "decision",
    "reasonCode",
    "payableAmountFormula",
    "penaltyAmountFormula",
    "ruleDescriptionVi",
  ] as const),
) {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version!: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

/** GET /payment-rules?ruleVersionId=v1&releaseRuleCode=R_GOODS_STD:DELIVERY */
export class PaymentRuleListQuery extends ListQueryDto {
  @IsOptional()
  @IsString()
  ruleVersionId?: string;

  @IsOptional()
  @Matches(RULE_SCOPE_CODE)
  releaseRuleCode?: string;
}
