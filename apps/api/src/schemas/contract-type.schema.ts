import { PartialType, PickType } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Min,
} from "class-validator";
import { ListQueryDto } from "./base.schema";
import { CODE, DECIMAL_2, RULE_SCOPE_CODE, VersionedDto } from "./common.schema";

/** "true"/"false" in a query string -> boolean. */
const toBoolean = ({ value }: { value: unknown }) => (value === "true" ? true : value === "false" ? false : value);

/** POST /contract-types */
export class CreateContractTypeDto {
  /** GOODS_SUPPLY */
  @Matches(CODE)
  code!: string;

  /** Cung cấp hàng hóa */
  @IsString()
  @Length(1, 200)
  name!: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

/** PATCH /contract-types/:code. The codes are referenced by contracts and rules, so they never change. */
export class UpdateContractTypeDto extends VersionedDto {
  @IsOptional()
  @IsString()
  @Length(1, 200)
  name?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

/** GET /contract-types?active=true */
export class ContractTypeListQuery extends ListQueryDto {
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  active?: boolean;
}

/** POST /contract-types/:code/stages: one stage of the template. */
export class CreateStageDto {
  /** Position in the template: 1, 2, 3... */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sequence!: number;

  /** DELIVERY */
  @Matches(CODE)
  milestoneType!: string;

  /** Giao hàng */
  @IsString()
  @Length(1, 200)
  name!: string;

  /** Share of the contract value, "40" or "12.50"; the stages of a type must add up to 100. */
  @Matches(DECIMAL_2)
  paymentPercent!: string;

  /** ["DELIVERY", "INVOICE"] */
  @IsArray()
  @ArrayMinSize(1)
  @Matches(CODE, { each: true })
  requiredEventTypes!: string[];

  @IsOptional()
  @IsBoolean()
  invoiceRequired?: boolean;

  @IsOptional()
  @IsBoolean()
  latePenaltyApplicable?: boolean;

  /** Due date = contract start + this many days. */
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offsetDays!: number;

  /** R_GOODS_STD:DELIVERY, a rule set of the same contract type. */
  @Matches(RULE_SCOPE_CODE)
  releaseRuleCode!: string;
}

/** PATCH /contract-types/:code/stages/:sequence: any field except the position. */
export class UpdateStageDto extends PartialType(
  PickType(CreateStageDto, [
    "milestoneType",
    "name",
    "paymentPercent",
    "requiredEventTypes",
    "invoiceRequired",
    "latePenaltyApplicable",
    "offsetDays",
    "releaseRuleCode",
  ] as const),
) {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version!: number;
}
