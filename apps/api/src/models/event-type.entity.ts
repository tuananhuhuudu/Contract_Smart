import { Check, Column, Entity, PrimaryColumn } from "typeorm";
import { BaseModel } from "./base.model";

export const EVENT_CATEGORIES = ["EVIDENCE", "APPROVAL", "REJECTION", "DISPUTE_OPEN", "DISPUTE_RESOLVE", "OTHER"] as const;
export const ACTOR_SIDES = ["BUYER", "SUPPLIER"] as const;

/**
 * Table event_types: the catalogue of event kinds (delivery, invoice, approval...). Every event and
 * every stage that requires events uses a code from here, so a milestone can never require an
 * event that nobody is able to record. category and actor_side tell the engine how to read an
 * event: evidence recorded by the buyer or the supplier, an approval, a rejection, a dispute.
 */
@Entity({
  name: "event_types",
  comment: "Danh mục loại sự kiện. Sự kiện và mốc mẫu chỉ dùng được loại có trong danh mục.",
})
@Check("event_types_code_check", `"code" ~ '^[A-Z][A-Z0-9_]*$'`)
@Check("event_types_name_check", `length(trim("name")) > 0`)
@Check("event_types_category_check", `"category" IN (${EVENT_CATEGORIES.map((c) => `'${c}'`).join(", ")})`)
@Check("event_types_side_check", `"actor_side" IN (${ACTOR_SIDES.map((s) => `'${s}'`).join(", ")})`)
// Only evidence says which side records it.
@Check("event_types_evidence_side_check", `("category" = 'EVIDENCE') = ("actor_side" IS NOT NULL)`)
export class EventType extends BaseModel {
  @PrimaryColumn({ type: "text", comment: "Mã loại sự kiện, ví dụ DELIVERY." })
  code!: string;

  @Column({ type: "text", comment: "Tên hiển thị, ví dụ Giao hàng." })
  name!: string;

  @Column({
    type: "text",
    comment: "Nhóm: EVIDENCE (chứng từ), APPROVAL, REJECTION, DISPUTE_OPEN, DISPUTE_RESOLVE, OTHER.",
  })
  category!: string;

  @Column({
    name: "actor_side",
    type: "text",
    nullable: true,
    comment: "Với chứng từ: bên được ghi (BUYER hoặc SUPPLIER); NULL với các nhóm khác.",
  })
  actorSide!: string | null;

  @Column({ type: "boolean", default: true, comment: "FALSE: không chọn được cho mốc mẫu và sự kiện mới." })
  active!: boolean;
}
