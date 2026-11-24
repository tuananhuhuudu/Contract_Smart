import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional } from "class-validator";
import { PAYMENT_STATUSES } from "../models/payment.entity";
import { ListQueryDto } from "./base.schema";

/** GET /payments */
export class PaymentListQuery extends ListQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() contractId?: number;
  @IsOptional() @IsIn(PAYMENT_STATUSES) status?: (typeof PAYMENT_STATUSES)[number];
}
