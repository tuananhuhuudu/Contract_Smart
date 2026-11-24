import { Check, Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Event } from "./event.entity";
import { Milestone } from "./milestone.entity";
import { DECISIONS, PaymentRule, REASON_CODES } from "./payment-rule.entity";

export const MILESTONE_STATUSES = [
  "PLANNED", "IN_PROGRESS", "WAITING_EVIDENCE", "WAITING_APPROVAL", "ON_HOLD", "REJECTED", "ELIGIBLE_FOR_PAYMENT", "PAID_WITH_PENALTY",
] as const;

const list = (values: readonly string[]): string => values.map((v) => `'${v}'`).join(", ");

/** What the engine computed and why: its variables, the outcome of every rule, missing and invalid events. */
export interface EvaluationFacts {
  variables: Record<string, unknown>;
  /** [rule id, "MATCHED" | "NOT_MATCHED" | "NOT_EVALUATED" | ...] in priority order. */
  trail: [string, string][];
  missing: string[];
  unauthorized: string[];
  duplicates: string[];
  unrelated: string[];
  openDisputeIds: string[];
  validApprovalCount: number;
  quorum: number;
  daysLate: number | null;
  completedAt: string | null;
  warnings: string[];
  issues: string[];
}

/**
 * Table milestone_evaluations: one row each time the engine judges a milestone (contract activation,
 * every recorded event, or a manual re-run). Append only; the newest row is the milestone's current
 * decision, the older rows are its history.
 */
@Entity({ name: "milestone_evaluations", comment: "Kết quả engine chấm một mốc. Mỗi lần chấm thêm một dòng, chỉ thêm (trigger); dòng mới nhất là trạng thái hiện tại." })
@Index("milestone_evaluations_latest_idx", ["milestoneId", "evaluatedAt"])
@Check("milestone_evaluations_decision_check", `"decision" IN (${list(DECISIONS)})`)
@Check("milestone_evaluations_reason_check", `"reason_code" IN (${list(REASON_CODES)})`)
@Check("milestone_evaluations_status_check", `"milestone_status" IN (${list(MILESTONE_STATUSES)})`)
@Check("milestone_evaluations_amounts_check", `"payable_vnd_mn" >= 0 AND "penalty_vnd_mn" >= 0`)
export class MilestoneEvaluation {
  @PrimaryGeneratedColumn({ comment: "Mã lần chấm (tự sinh)." })
  id!: number;

  @Column({ name: "milestone_id", type: "integer", comment: "Mốc được chấm (milestones.id)." })
  milestoneId!: number;

  @Column({ name: "trigger_event_id", type: "integer", nullable: true, comment: "Sự kiện làm engine chấm lại (events.id); NULL khi chấm lúc kích hoạt hoặc bấm Chấm lại." })
  triggerEventId!: number | null;

  @Column({ name: "rule_id", type: "integer", nullable: true, comment: "Luật quyết định (payment_rules.id); NULL khi không luật nào khớp." })
  ruleId!: number | null;

  @Column({ type: "text", comment: "Quyết định: RELEASE (trả), HOLD (giữ), REJECT (từ chối), PENALTY (trả có trừ phạt)." })
  decision!: (typeof DECISIONS)[number];

  @Column({ name: "reason_code", type: "text", comment: "Lý do (mã lý do của luật quyết định)." })
  reasonCode!: (typeof REASON_CODES)[number];

  @Column({ name: "milestone_status", type: "text", comment: "Trạng thái mốc sau khi chấm, ví dụ WAITING_EVIDENCE, ON_HOLD, ELIGIBLE_FOR_PAYMENT." })
  milestoneStatus!: (typeof MILESTONE_STATUSES)[number];

  @Column({ name: "payable_vnd_mn", type: "numeric", precision: 18, scale: 2, comment: "Tiền được trả (triệu VND)." })
  payableVndMn!: string;

  @Column({ name: "penalty_vnd_mn", type: "numeric", precision: 18, scale: 2, comment: "Tiền phạt (triệu VND)." })
  penaltyVndMn!: string;

  @Column({ type: "jsonb", comment: "Vì sao: các con số engine tính, kết quả từng luật, chứng từ thiếu / sai thẩm quyền, cảnh báo." })
  facts!: EvaluationFacts;

  @CreateDateColumn({ name: "evaluated_at", type: "timestamptz", comment: "Lúc chấm." })
  evaluatedAt!: Date;

  @ManyToOne(() => Milestone, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "milestone_id", foreignKeyConstraintName: "milestone_evaluations_milestone_fkey" })
  milestone!: Milestone;

  @ManyToOne(() => Event, { onDelete: "RESTRICT", nullable: true })
  @JoinColumn({ name: "trigger_event_id", foreignKeyConstraintName: "milestone_evaluations_event_fkey" })
  triggerEvent!: Event | null;

  @ManyToOne(() => PaymentRule, { onDelete: "RESTRICT", nullable: true })
  @JoinColumn({ name: "rule_id", foreignKeyConstraintName: "milestone_evaluations_rule_fkey" })
  rule!: PaymentRule | null;
}
