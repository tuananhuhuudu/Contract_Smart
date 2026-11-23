import { Check, Column, Entity, Index, PrimaryGeneratedColumn } from "typeorm";
import { BaseModel } from "./base.model";

export const EVENT_CATEGORIES = ["EVIDENCE", "APPROVAL", "REJECTION", "DISPUTE_OPEN", "DISPUTE_RESOLVE", "OTHER"] as const;
export type EventCategory = (typeof EVENT_CATEGORIES)[number];
export const ACTOR_SIDES = ["BUYER", "SUPPLIER"] as const;
export const EVENT_STATUSES = ["CONFIRMED", "APPROVED", "REJECTED", "OPEN", "RESOLVED"] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

const list = (values: readonly string[]): string => values.map((v) => `'${v}'`).join(", ");

/**
 * Table event_types: the buttons people press to record what happened (delivery, invoice,
 * approval...). The engine never reads the name, only the category: a new evidence type works
 * without code changes. valid_status is what the API writes on every event of this type.
 */
@Entity({ name: "event_types", comment: "Danh mục loại sự kiện. Engine chỉ đọc nhóm (category), không đọc tên." })
@Index("event_types_name_key", ["name"], { unique: true })
@Check("event_types_name_check", `length(trim("name")) > 0`)
@Check("event_types_category_check", `"category" IN (${list(EVENT_CATEGORIES)})`)
@Check("event_types_side_check", `"actor_side" IN (${list(ACTOR_SIDES)})`)
// Only evidence says which side records it.
@Check("event_types_evidence_side_check", `("category" = 'EVIDENCE') = ("actor_side" IS NOT NULL)`)
@Check("event_types_valid_status_check", `"valid_status" IN (${list(EVENT_STATUSES)})`)
export class EventType extends BaseModel {
  @PrimaryGeneratedColumn({ comment: "Mã loại sự kiện (tự sinh)." })
  id!: number;

  @Column({ type: "text", comment: "Tên hiển thị trên nút, ví dụ Giao hàng." })
  name!: string;

  @Column({ type: "text", comment: "Nhóm: EVIDENCE (chứng từ), APPROVAL, REJECTION, DISPUTE_OPEN, DISPUTE_RESOLVE, OTHER." })
  category!: EventCategory;

  @Column({ name: "actor_side", type: "text", nullable: true, comment: "Với chứng từ: bên được ghi (BUYER hoặc SUPPLIER); NULL với các nhóm khác." })
  actorSide!: (typeof ACTOR_SIDES)[number] | null;

  @Column({ name: "valid_status", type: "text", comment: "Trạng thái API tự điền cho mọi sự kiện loại này: CONFIRMED, APPROVED, REJECTED, OPEN, RESOLVED." })
  validStatus!: EventStatus;

  @Column({ type: "boolean", default: true, comment: "FALSE: ẩn khỏi danh sách chọn; sự kiện cũ vẫn giữ." })
  active!: boolean;
}
