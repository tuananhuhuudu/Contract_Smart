import { Transform, Type } from "class-transformer";
import { ArrayUnique, IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Length, Min } from "class-validator";
import { DECISIONS, REASON_CODES } from "../models/payment-rule.entity";
import { ListQueryDto } from "./base.schema";
import { VersionedDto } from "./common.schema";

/** POST /milestone-library: a new milestone with an empty draft v1, or a copy of another milestone's rules. */
export class CreateMilestoneDto {
  /** Nộp báo cáo */
  @IsString()
  @Length(1, 200)
  name!: string;

  /** Start v1 from the published version of this milestone (events, late penalty and rules). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  copyFromMilestoneId?: number;
}

/** PATCH /milestone-library/:id */
export class UpdateMilestoneDto extends VersionedDto {
  @IsOptional()
  @IsString()
  @Length(1, 200)
  name?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

/** GET /milestone-library?active=true */
export class MilestoneListQuery extends ListQueryDto {
  @IsOptional()
  @Transform(({ value }) => (value === "true" ? true : value === "false" ? false : value))
  @IsBoolean()
  active?: boolean;
}

/** PATCH /milestone-versions/:id (drafts only) */
export class UpdateVersionDto extends VersionedDto {
  /** Evidence event types that must all be present before the milestone can be paid. */
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true })
  requiredEventTypeIds?: number[];

  @IsOptional()
  @IsBoolean()
  latePenalty?: boolean;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  note?: string;
}

/** POST /milestone-versions/:id/rules */
export class CreateRuleDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  priority!: number;

  /** Đang tranh chấp thì giữ tiền */
  @IsString()
  @Length(1, 200)
  name!: string;

  /** open_dispute == TRUE, or ELSE for the last rule */
  @IsString()
  @Length(1, 1000)
  condition!: string;

  @IsIn(DECISIONS)
  decision!: (typeof DECISIONS)[number];

  @IsIn(REASON_CODES)
  reasonCode!: (typeof REASON_CODES)[number];

  @IsOptional()
  @IsString()
  @Length(1, 1000)
  payableFormula?: string;

  @IsOptional()
  @IsString()
  @Length(1, 1000)
  penaltyFormula?: string;
}

/** PATCH /payment-rules/:id (drafts only) */
export class UpdateRuleDto extends VersionedDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) priority?: number;
  @IsOptional() @IsString() @Length(1, 200) name?: string;
  @IsOptional() @IsString() @Length(1, 1000) condition?: string;
  @IsOptional() @IsIn(DECISIONS) decision?: (typeof DECISIONS)[number];
  @IsOptional() @IsIn(REASON_CODES) reasonCode?: (typeof REASON_CODES)[number];
  @IsOptional() @IsString() @Length(1, 1000) payableFormula?: string;
  @IsOptional() @IsString() @Length(1, 1000) penaltyFormula?: string;
}
