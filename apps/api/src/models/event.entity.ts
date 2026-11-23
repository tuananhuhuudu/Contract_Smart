import { Check, Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn, type ValueTransformer } from "typeorm";
import { EventType } from "./event-type.entity";
import { Milestone } from "./milestone.entity";
import { Party } from "./party.entity";

export const EVENT_STATUSES = ["CONFIRMED", "APPROVED", "REJECTED", "OPEN", "RESOLVED"] as const;
export const EVENT_SOURCES = ["PORTAL", "API", "WORKFLOW_ENGINE", "MANUAL_ENTRY"] as const;

const list = (values: readonly string[]) => values.map((v) => `'${v}'`).join(", ");

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Keeps event_timestamp a wall-clock string ("2026-06-06T10:20:00") in both directions. TypeORM
 * turns a "timestamp" column into a Date when reading; comparing that Date with a string silently
 * fails, so the Date is turned back into the same wall-clock text (both steps use local time).
 */
export const wallClock: ValueTransformer = {
  to: (value: string | undefined) => value,
  from: (value: Date | string | null) =>
    value instanceof Date
      ? `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`
      : value,
};

/**
 * Table events: what happened while a contract runs (delivery, invoice, approval, dispute...). The
 * engine evaluates milestones from these rows. Append-only: a trigger refuses UPDATE, DELETE and
 * TRUNCATE; a wrong event is voided through an exception request, never edited. So, unlike the
 * other tables, it has no version and no updated_at.
 * Columns the Data Pack repeats (contract_id, contract_event_sequence, actor_party_type, actor_role,
 * data_is_synthetic) are rebuilt by the view engine_events.
 */
@Entity({
  name: "events",
  comment: "Sự kiện đã xảy ra trong hợp đồng (giao hàng, hóa đơn, phê duyệt, tranh chấp...). Chỉ thêm, không sửa, không xóa.",
})
@Index("events_milestone_time_idx", ["milestoneId", "eventTimestamp"])
@Index("events_actor_idx", ["actorPartyId"])
@Index("events_type_idx", ["eventType"])
@Check("events_status_check", `"event_status" IN (${list(EVENT_STATUSES)})`)
@Check("events_source_check", `"event_source" IN (${list(EVENT_SOURCES)})`)
@Check("events_amount_check", `"amount_vnd_mn" >= 0`)
// Only closing a dispute points at another event (the one that opened it).
@Check("events_reference_check", `("event_type" = 'DISPUTE_RESOLVED') = ("reference_event_id" IS NOT NULL)`)
export class Event {
  @PrimaryColumn({ name: "event_id", type: "text", comment: "Mã sự kiện, ví dụ EV00003." })
  eventId!: string;

  @Column({ name: "milestone_id", type: "text", comment: "Mốc của sự kiện (khóa ngoại tới milestones); hợp đồng suy ra từ mốc." })
  milestoneId!: string;

  /** Wall-clock time with no time zone, as in the Data Pack: "2026-06-06T10:20:00". */
  @Column({ name: "event_timestamp", type: "timestamp", transformer: wallClock, comment: "Thời điểm xảy ra (không múi giờ, như dữ liệu của đề)." })
  eventTimestamp!: string;

  @Column({ name: "event_type", type: "text", comment: "Loại sự kiện (khóa ngoại tới event_types), ví dụ DELIVERY, INVOICE, APPROVAL." })
  eventType!: string;

  @Column({ name: "event_status", type: "text", comment: "CONFIRMED, APPROVED, REJECTED, OPEN hoặc RESOLVED." })
  eventStatus!: string;

  @Column({
    name: "actor_party_id",
    type: "text",
    comment: "Bên thực hiện (khóa ngoại tới parties); loại bên và vai trò lấy từ parties.",
  })
  actorPartyId!: string;

  @Column({ name: "event_source", type: "text", default: "PORTAL", comment: "Kênh: PORTAL, API, WORKFLOW_ENGINE, MANUAL_ENTRY." })
  eventSource!: string;

  @Column({ name: "document_id", type: "text", nullable: true, comment: "Mã chứng từ kèm theo." })
  documentId!: string | null;

  @Column({
    name: "amount_vnd_mn",
    type: "numeric",
    precision: 18,
    scale: 2,
    nullable: true,
    comment: "Số tiền gắn với sự kiện (hóa đơn, phê duyệt), triệu VND.",
  })
  amountVndMn!: string | null;

  @Column({
    name: "reference_event_id",
    type: "text",
    nullable: true,
    comment: "Chỉ với DISPUTE_RESOLVED: sự kiện DISPUTE_OPENED được đóng.",
  })
  referenceEventId!: string | null;

  @Column({ name: "event_note", type: "text", default: "", comment: "Ghi chú ngắn." })
  eventNote!: string;

  @CreateDateColumn({ name: "created_at", type: "timestamptz", comment: "Thời điểm ghi vào hệ thống." })
  createdAt!: Date;

  @ManyToOne(() => Milestone, { onDelete: "RESTRICT", onUpdate: "CASCADE" })
  @JoinColumn({ name: "milestone_id", referencedColumnName: "milestoneId", foreignKeyConstraintName: "events_milestone_fkey" })
  milestone!: Milestone;

  @ManyToOne(() => EventType, { onDelete: "RESTRICT", onUpdate: "CASCADE" })
  @JoinColumn({ name: "event_type", referencedColumnName: "code", foreignKeyConstraintName: "events_event_type_fkey" })
  type!: EventType;

  @ManyToOne(() => Party, { onDelete: "RESTRICT", onUpdate: "CASCADE" })
  @JoinColumn({ name: "actor_party_id", referencedColumnName: "partyId", foreignKeyConstraintName: "events_actor_fkey" })
  actor!: Party;

  @ManyToOne(() => Event, { nullable: true, onDelete: "RESTRICT", onUpdate: "CASCADE", deferrable: "INITIALLY DEFERRED" })
  @JoinColumn({ name: "reference_event_id", referencedColumnName: "eventId", foreignKeyConstraintName: "events_reference_fkey" })
  referenceEvent!: Event | null;
}
