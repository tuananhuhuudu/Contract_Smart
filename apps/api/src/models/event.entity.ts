import { Check, Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { wallClock } from "../utils/dates";
import { EVENT_STATUSES, EventType, type EventStatus } from "./event-type.entity";
import { Milestone } from "./milestone.entity";
import { Party } from "./party.entity";
import { User } from "./user.entity";

const list = (values: readonly string[]): string => values.map((v) => `'${v}'`).join(", ");

/**
 * Table events: what happened on a milestone (delivery, invoice, approval, dispute...). Append only:
 * a mistake is corrected by recording another event, never by editing (trigger). No BaseModel: an
 * event is never updated, so it has no version or updated_at.
 */
@Entity({ name: "events", comment: "Sự kiện đã xảy ra trên một mốc. Chỉ thêm, không sửa, không xóa (trigger)." })
@Index("events_milestone_idx", ["milestoneId", "happenedAt"])
@Check("events_status_check", `"status" IN (${list(EVENT_STATUSES)})`)
export class Event {
  @PrimaryGeneratedColumn({ comment: "Mã sự kiện (tự sinh)." })
  id!: number;

  @Column({ name: "milestone_id", type: "integer", comment: "Xảy ra ở mốc nào (milestones.id)." })
  milestoneId!: number;

  @Column({ name: "event_type_id", type: "integer", comment: "Loại sự kiện (event_types.id)." })
  eventTypeId!: number;

  @Column({ type: "text", comment: "Trạng thái, API tự điền theo event_types.valid_status." })
  status!: EventStatus;

  @Column({ name: "party_id", type: "integer", comment: "Bên thực hiện (parties.id)." })
  partyId!: number;

  @Column({ name: "recorded_by", type: "uuid", nullable: true, comment: "Người bấm nút (users.id); NULL khi chưa có đăng nhập." })
  recordedBy!: string | null;

  @Column({ name: "happened_at", type: "timestamp", transformer: wallClock, comment: "Lúc xảy ra, giờ Việt Nam không múi giờ, ví dụ 2026-06-05T09:50:00." })
  happenedAt!: string;

  @Column({ name: "document_no", type: "text", nullable: true, comment: "Số giấy tờ (hóa đơn, biên bản); engine dùng để phát hiện nộp trùng." })
  documentNo!: string | null;

  @Column({ name: "resolves_event_id", type: "integer", nullable: true, comment: "Chỉ với Đóng tranh chấp: đóng sự kiện Mở tranh chấp nào (events.id)." })
  resolvesEventId!: number | null;

  @Column({ type: "text", default: "", comment: "Ghi chú." })
  note!: string;

  @CreateDateColumn({ name: "created_at", type: "timestamptz", comment: "Lúc lưu vào DB." })
  createdAt!: Date;

  @ManyToOne(() => Milestone, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "milestone_id", foreignKeyConstraintName: "events_milestone_fkey" })
  milestone!: Milestone;

  @ManyToOne(() => EventType, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "event_type_id", foreignKeyConstraintName: "events_type_fkey" })
  eventType!: EventType;

  @ManyToOne(() => Party, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "party_id", foreignKeyConstraintName: "events_party_fkey" })
  party!: Party;

  @ManyToOne(() => User, { onDelete: "RESTRICT", nullable: true })
  @JoinColumn({ name: "recorded_by", foreignKeyConstraintName: "events_recorded_by_fkey" })
  recorder!: User | null;

  @ManyToOne(() => Event, { onDelete: "RESTRICT", nullable: true })
  @JoinColumn({ name: "resolves_event_id", foreignKeyConstraintName: "events_resolves_fkey" })
  resolves!: Event | null;
}
