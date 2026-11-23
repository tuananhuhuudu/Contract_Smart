import { Check, Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { BaseModel } from "./base.model";
import { MilestoneVersion } from "./milestone-version.entity";

export const DECISIONS = ["RELEASE", "HOLD", "REJECT", "PENALTY"] as const;
/** Reason codes the engine knows; each one maps to a milestone status in the engine policy. */
export const REASON_CODES = [
  "OPEN_DISPUTE", "REJECTION_PRESENT", "UNAUTHORIZED_EVENT", "MISSING_REQUIRED_EVENT",
  "APPROVAL_QUORUM_NOT_MET", "LATE_COMPLETION", "ALL_CONDITIONS_MET", "UNRESOLVED_CONDITION",
] as const;

const list = (values: readonly string[]): string => values.map((v) => `'${v}'`).join(", ");

/**
 * Table payment_rules: "if ... then ... because ..." rules of one milestone version. The engine
 * tries them by priority and the first one whose condition holds decides. Rules of a version that
 * is no longer a draft cannot be added, changed or removed (trigger).
 */
@Entity({ name: "payment_rules", comment: "Luật của một phiên bản mốc: nếu ... thì ... vì .... Xét theo ưu tiên, luật đầu tiên khớp quyết định." })
@Index("payment_rules_priority_key", ["milestoneVersionId", "priority"], { unique: true })
@Check("payment_rules_priority_check", `"priority" >= 1`)
@Check("payment_rules_name_check", `length(trim("name")) > 0`)
@Check("payment_rules_condition_check", `length(trim("condition")) > 0`)
@Check("payment_rules_decision_check", `"decision" IN (${list(DECISIONS)})`)
@Check("payment_rules_reason_check", `"reason_code" IN (${list(REASON_CODES)})`)
export class PaymentRule extends BaseModel {
  @PrimaryGeneratedColumn({ comment: "Mã luật (tự sinh)." })
  id!: number;

  @Column({ name: "milestone_version_id", type: "integer", comment: "Luật của phiên bản mốc nào (milestone_versions.id)." })
  milestoneVersionId!: number;

  @Column({ type: "integer", comment: "Thứ tự xét: 10, 20... số nhỏ xét trước." })
  priority!: number;

  @Column({ type: "text", comment: "Tên luật tiếng Việt, ví dụ Đang tranh chấp thì giữ tiền." })
  name!: string;

  @Column({ type: "text", comment: "Điều kiện cho engine, ví dụ open_dispute == TRUE; luật cuối là ELSE." })
  condition!: string;

  @Column({ type: "text", comment: "Quyết định: RELEASE (trả), HOLD (giữ), REJECT (từ chối), PENALTY (trả có trừ phạt)." })
  decision!: (typeof DECISIONS)[number];

  @Column({ name: "reason_code", type: "text", comment: "Lý do, một trong 8 mã engine biết, ví dụ MISSING_REQUIRED_EVENT." })
  reasonCode!: (typeof REASON_CODES)[number];

  @Column({ name: "payable_formula", type: "text", default: "0", comment: "Công thức tiền được trả, ví dụ planned_payment_vnd_mn." })
  payableFormula!: string;

  @Column({ name: "penalty_formula", type: "text", default: "0", comment: "Công thức tiền phạt." })
  penaltyFormula!: string;

  @ManyToOne(() => MilestoneVersion, (version) => version.rules, { onDelete: "CASCADE" })
  @JoinColumn({ name: "milestone_version_id", foreignKeyConstraintName: "payment_rules_version_fkey" })
  milestoneVersion!: MilestoneVersion;
}
