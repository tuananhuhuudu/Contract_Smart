import { Type } from "class-transformer";
import { IsInt, Min } from "class-validator";

/** Upper-case business codes: GOODS_SUPPLY, WF_GOODS_4STAGE, DELIVERY. */
export const CODE = /^[A-Z][A-Z0-9_]*$/;
/** Rule set codes: R_GOODS_STD:DELIVERY. */
export const RULE_SCOPE_CODE = /^[A-Z][A-Z0-9_]*:[A-Z][A-Z0-9_]*$/;
/** Non-negative decimal with at most 2 places, as a string: "1290", "516.50", "0.10". */
export const DECIMAL_2 = /^\d+(\.\d{1,2})?$/;
/** Calendar date: 2026-04-21. */
export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const ORIGINS = ["DATA_PACK", "SEED", "APP"] as const;

/** Body field of every update: the version the client last read (optimistic locking, 409 if stale). */
export class VersionedDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version!: number;
}
