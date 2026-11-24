import { Check, Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { BaseModel } from "./base.model";
import { MilestoneEvaluation } from "./milestone-evaluation.entity";
import { Milestone } from "./milestone.entity";
import { User } from "./user.entity";

/** PENDING: waiting for the buyer's finance approver; PAID: approved and sent; CANCELLED: the engine no longer pays this amount. */
export const PAYMENT_STATUSES = ["PENDING", "PAID", "CANCELLED"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

const list = (values: readonly string[]): string => values.map((v) => `'${v}'`).join(", ");

/**
 * Table payments: the payment order of one milestone. The system opens it when the engine decides to
 * pay (RELEASE or PENALTY); only the buyer's finance approver approves it, and approving sends it to the
 * payment gateway (simulated) and marks the milestone paid. If a later evaluation no longer pays the
 * same amount, the pending order is cancelled and, when the engine pays again, a new one is opened.
 * A milestone has at most one order that is not cancelled. Rows are never deleted; a paid order never changes.
 */
@Entity({ name: "payments", comment: "Lệnh chi của một mốc: hệ thống lập khi engine cho trả, duyệt tài chính bên mua duyệt thì chi. Không xóa; đã chi thì không sửa." })
@Index("payments_one_open_per_milestone", ["milestoneId"], { unique: true, where: `"status" <> 'CANCELLED'` })
@Index("payments_milestone_idx", ["milestoneId"])
@Check("payments_status_check", `"status" IN (${list(PAYMENT_STATUSES)})`)
@Check("payments_amounts_check", `"amount_vnd_mn" > 0 AND "penalty_vnd_mn" >= 0`)
@Check("payments_paid_check", `("status" = 'PAID') = ("paid_at" IS NOT NULL AND "approved_by" IS NOT NULL AND "gateway_ref" IS NOT NULL)`)
export class Payment extends BaseModel {
  @PrimaryGeneratedColumn({ comment: "Mã lệnh chi (tự sinh)." })
  id!: number;

  @Column({ name: "milestone_id", type: "integer", comment: "Mốc được chi (milestones.id)." })
  milestoneId!: number;

  @Column({ name: "evaluation_id", type: "integer", comment: "Lần chấm của engine làm căn cứ chi (milestone_evaluations.id)." })
  evaluationId!: number;

  @Column({ name: "amount_vnd_mn", type: "numeric", precision: 18, scale: 2, comment: "Số tiền chi cho nhà cung cấp (triệu VND), đã trừ phạt." })
  amountVndMn!: string;

  @Column({ name: "penalty_vnd_mn", type: "numeric", precision: 18, scale: 2, comment: "Tiền phạt đã trừ (triệu VND)." })
  penaltyVndMn!: string;

  @Column({ type: "text", default: "PENDING", comment: "PENDING (chờ duyệt chi), PAID (đã chi), CANCELLED (đã hủy vì engine chấm lại)." })
  status!: PaymentStatus;

  @Column({ name: "approved_by", type: "uuid", nullable: true, comment: "Người duyệt tài chính đã duyệt (users.id)." })
  approvedBy!: string | null;

  @Column({ name: "paid_at", type: "timestamptz", nullable: true, comment: "Lúc duyệt và gửi cổng thanh toán." })
  paidAt!: Date | null;

  @Column({ name: "gateway_ref", type: "text", nullable: true, comment: "Mã giao dịch cổng thanh toán trả về (bản demo: SIM-...)." })
  gatewayRef!: string | null;

  @Column({ type: "text", default: "", comment: "Ghi chú, ví dụ lý do hủy." })
  note!: string;

  @ManyToOne(() => Milestone, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "milestone_id", foreignKeyConstraintName: "payments_milestone_fkey" })
  milestone!: Milestone;

  @ManyToOne(() => MilestoneEvaluation, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "evaluation_id", foreignKeyConstraintName: "payments_evaluation_fkey" })
  evaluation!: MilestoneEvaluation;

  @ManyToOne(() => User, { onDelete: "RESTRICT", nullable: true })
  @JoinColumn({ name: "approved_by", foreignKeyConstraintName: "payments_approved_by_fkey" })
  approver!: User | null;
}
