import { Transform, Type } from "class-transformer";
import { IsBoolean, IsInt, IsOptional, IsString, Length, Matches, Min } from "class-validator";
import { ListQueryDto } from "./base.schema";
import { VersionedDto } from "./common.schema";

/** A percentage with at most 2 decimals, as a string: "40", "33.33". */
export const PERCENT = /^\d{1,3}(\.\d{1,2})?$/;

/** POST /contract-types */
export class CreateContractTypeDto {
  /** Tư vấn */
  @IsString()
  @Length(1, 200)
  name!: string;
}

/** PATCH /contract-types/:id */
export class UpdateContractTypeDto extends VersionedDto {
  @IsOptional() @IsString() @Length(1, 200) name?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}

/** GET /contract-types?active=true */
export class ContractTypeListQuery extends ListQueryDto {
  @IsOptional()
  @Transform(({ value }) => (value === "true" ? true : value === "false" ? false : value))
  @IsBoolean()
  active?: boolean;
}

/** POST /contract-types/:id/milestones: add a library milestone to the template. */
export class AddTemplateMilestoneDto {
  @Type(() => Number)
  @IsInt()
  milestoneId!: number;

  /** "40.00" */
  @Matches(PERCENT)
  paymentPercent!: string;

  /** Due date = contract start + this many days. */
  @Type(() => Number)
  @IsInt()
  @Min(0)
  dueAfterDays!: number;
}

/** PATCH /contract-type-milestones/:id */
export class UpdateTemplateMilestoneDto extends VersionedDto {
  @IsOptional() @Matches(PERCENT) paymentPercent?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) dueAfterDays?: number;
}
