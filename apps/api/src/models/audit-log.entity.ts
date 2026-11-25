import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from "typeorm";
import { Contract } from "./contract.entity";
import { Party } from "./party.entity";
import { User } from "./user.entity";

/** What an entry records. Grouped as in the business flow: accounts, contracts, events, engine, payments. */
export const AUDIT_ACTIONS = [
  "LOGIN_FAILED", "ORG_CREATED", "ORG_LOCKED", "ORG_UNLOCKED",
  "USER_CREATED", "USER_UPDATED", "USER_LOCKED", "USER_UNLOCKED", "PASSWORD_RESET", "PASSWORD_CHANGED",
  "CONTRACT_CREATED", "CONTRACT_UPDATED", "CONTRACT_ACTIVATED", "CONTRACT_CLOSED",
  "MILESTONE_ADDED", "MILESTONE_UPDATED", "MILESTONE_REMOVED", "MILESTONE_CUSTOM_RULES", "MILESTONE_SHARED_RULES",
  "EVENT_RECORDED", "DISPUTE_OPENED", "DISPUTE_CLOSED",
  "MILESTONE_EVALUATED",
  "PAYMENT_OPENED", "PAYMENT_CANCELLED", "PAYMENT_APPROVED",
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

/**
 * Table audit_log: who did what, when, on what. Append-only and hash-chained: a trigger numbers each
 * new entry, links it to the previous one (prev_hash) and seals it (hash = SHA-256 of the entry), and
 * any UPDATE, DELETE or TRUNCATE is refused. audit_verify() recomputes the chain: an entry changed or
 * removed behind the triggers' back breaks it from that entry on. The actor's role and company are
 * copied in, so an entry still reads right after the account changes.
 */
@Entity({ name: "audit_log", comment: "Nhật ký kiểm toán: ai làm gì, lúc nào, trên cái gì. Chỉ thêm; mỗi dòng nối mã băm dòng trước, không sửa, không xóa." })
@Index("audit_log_contract_idx", ["contractId"])
@Index("audit_log_organization_idx", ["organizationId"])
@Index("audit_log_actor_organization_idx", ["actorOrganizationId"])
export class AuditLog {
  @PrimaryColumn({ type: "bigint", comment: "Số thứ tự trong chuỗi (trigger cấp, liên tục từ 1)." })
  id!: string;

  @Column({ name: "occurred_at", type: "timestamptz", comment: "Lúc ghi (trigger đặt bằng giờ máy chủ CSDL)." })
  occurredAt!: Date;

  @Column({ name: "actor_id", type: "uuid", nullable: true, comment: "Người làm (users.id); trống: hệ thống làm, ví dụ engine chấm." })
  actorId!: string | null;

  @Column({ name: "actor_email", type: "text", nullable: true, comment: "Email người làm lúc đó (chụp lại)." })
  actorEmail!: string | null;

  @Column({ name: "actor_role", type: "text", nullable: true, comment: "Vai người làm lúc đó (chụp lại, vai có thể đổi sau)." })
  actorRole!: string | null;

  @Column({ name: "actor_organization_id", type: "integer", nullable: true, comment: "Công ty của người làm lúc đó (parties.id, bên mua hoặc nhà cung cấp)." })
  actorOrganizationId!: number | null;

  @Column({ type: "text", comment: "Hành động, ví dụ CONTRACT_ACTIVATED, EVENT_RECORDED, PAYMENT_APPROVED." })
  action!: AuditAction;

  @Column({ type: "text", comment: "Loại đối tượng: organization, user, contract, milestone, event, evaluation, payment." })
  resource!: string;

  @Column({ name: "resource_id", type: "text", comment: "Mã đối tượng." })
  resourceId!: string;

  @Column({ name: "contract_id", type: "integer", nullable: true, comment: "Hợp đồng liên quan (contracts.id), để lọc theo hợp đồng và theo bên." })
  contractId!: number | null;

  @Column({ name: "organization_id", type: "integer", nullable: true, comment: "Công ty mà dòng này nói tới (tài khoản, khóa công ty), để quản trị công ty xem." })
  organizationId!: number | null;

  @Column({ type: "jsonb", nullable: true, comment: "Giá trị trước khi đổi (chỉ các trường đổi)." })
  before!: Record<string, unknown> | null;

  @Column({ type: "jsonb", nullable: true, comment: "Giá trị sau khi đổi, hoặc nội dung mới tạo." })
  after!: Record<string, unknown> | null;

  @Column({ type: "text", default: "", comment: "Lý do hoặc ghi chú." })
  reason!: string;

  @Column({ name: "prev_hash", type: "char", length: 64, comment: "Mã băm của dòng ngay trước (dòng đầu: 64 số 0)." })
  prevHash!: string;

  @Column({ type: "char", length: 64, unique: true, comment: "SHA-256 của chính dòng này, kể cả prev_hash." })
  hash!: string;

  @ManyToOne(() => User, { onDelete: "RESTRICT", nullable: true })
  @JoinColumn({ name: "actor_id", foreignKeyConstraintName: "audit_log_actor_fkey" })
  actor!: User | null;

  @ManyToOne(() => Party, { onDelete: "RESTRICT", nullable: true })
  @JoinColumn({ name: "actor_organization_id", foreignKeyConstraintName: "audit_log_actor_organization_fkey" })
  actorOrganization!: Party | null;

  @ManyToOne(() => Party, { onDelete: "RESTRICT", nullable: true })
  @JoinColumn({ name: "organization_id", foreignKeyConstraintName: "audit_log_organization_fkey" })
  organization!: Party | null;

  @ManyToOne(() => Contract, { onDelete: "RESTRICT", nullable: true })
  @JoinColumn({ name: "contract_id", foreignKeyConstraintName: "audit_log_contract_fkey" })
  contract!: Contract | null;
}
