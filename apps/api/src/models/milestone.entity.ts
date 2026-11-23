import { Check, Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn, Unique } from "typeorm";
import { BaseModel, ORIGIN_CHECK } from "./base.model";
import { Contract } from "./contract.entity";
import { RuleScope } from "./rule-scope.entity";

/**
 * Table milestones (Data Pack columns): one payment stage of one contract, with its amount, due
 * date, conditions and the rule set that evaluates it. Generated from contract_type_stages when a
 * contract is created; after that it no longer depends on the template.
 */
@Entity({ name: "milestones", comment: "Mốc thanh toán thật của một hợp đồng: số tiền, hạn, điều kiện và bộ luật dùng để chấm." })
@Unique("milestones_contract_sequence_key", ["contractId", "milestoneSequence"])
@Index("milestones_release_rule_code_idx", ["releaseRuleCode"])
@Check("milestones_sequence_check", `"milestone_sequence" >= 1`)
@Check("milestones_percent_check", `"payment_percent" BETWEEN 0 AND 100`)
@Check("milestones_amount_check", `"planned_payment_vnd_mn" >= 0`)
@Check("milestones_logic_check", `"condition_logic" = 'ALL'`)
@Check("milestones_numbers_check", `"required_approval_quorum" >= 0 AND "grace_period_days" >= 0 AND "penalty_rate_pct_per_day" >= 0 AND "max_penalty_pct" >= 0`)
@Check("milestones_origin_check", ORIGIN_CHECK)
export class Milestone extends BaseModel {
  @PrimaryColumn({ name: "milestone_id", type: "text", comment: "Mã mốc, ví dụ MS0002." })
  milestoneId!: string;

  @Column({ name: "contract_id", type: "text", comment: "Hợp đồng chứa mốc (khóa ngoại tới contracts)." })
  contractId!: string;

  @Column({ name: "milestone_sequence", type: "integer", comment: "Thứ tự mốc trong hợp đồng (1, 2, 3...)." })
  milestoneSequence!: number;

  @Column({ name: "milestone_type", type: "text", comment: "Loại mốc, ví dụ DELIVERY." })
  milestoneType!: string;

  @Column({ name: "milestone_name", type: "text", comment: "Tên hiển thị của mốc." })
  milestoneName!: string;

  @Column({ name: "due_date", type: "date", comment: "Hạn hoàn thành mốc." })
  dueDate!: string;

  @Column({ name: "payment_percent", type: "numeric", precision: 5, scale: 2, comment: "% giá trị hợp đồng gắn với mốc." })
  paymentPercent!: string;

  @Column({ name: "planned_payment_vnd_mn", type: "numeric", precision: 18, scale: 2, comment: "Số tiền dự kiến trả (triệu VND)." })
  plannedPaymentVndMn!: string;

  @Column({ name: "condition_logic", type: "text", default: "ALL", comment: "Cách gộp điều kiện; ALL: phải đủ tất cả." })
  conditionLogic!: string;

  @Column({ name: "required_event_types", type: "text", array: true, comment: "Sự kiện bắt buộc, ví dụ {DELIVERY, INVOICE}." })
  requiredEventTypes!: string[];

  @Column({ name: "required_condition", type: "text", comment: "Mô tả điều kiện dạng chữ, để người đọc." })
  requiredCondition!: string;

  @Column({ name: "invoice_required", type: "boolean", default: false, comment: "Mốc có cần hóa đơn không." })
  invoiceRequired!: boolean;

  @Column({ name: "approval_required", type: "boolean", default: false, comment: "Mốc có cần phê duyệt thủ công không." })
  approvalRequired!: boolean;

  @Column({ name: "required_approval_quorum", type: "integer", default: 0, comment: "Cần mấy phê duyệt." })
  requiredApprovalQuorum!: number;

  @Column({ name: "required_approval_roles", type: "text", array: true, default: () => "'{}'", comment: "Vai trò được tính vào số phê duyệt." })
  requiredApprovalRoles!: string[];

  @Column({ name: "hold_on_open_dispute", type: "boolean", default: true, comment: "Có tranh chấp đang mở thì tạm giữ tiền." })
  holdOnOpenDispute!: boolean;

  @Column({ name: "late_penalty_applicable", type: "boolean", default: false, comment: "Mốc có tính phạt trễ không." })
  latePenaltyApplicable!: boolean;

  @Column({ name: "grace_period_days", type: "integer", default: 0, comment: "Ngày ân hạn của mốc." })
  gracePeriodDays!: number;

  @Column({ name: "penalty_rate_pct_per_day", type: "numeric", precision: 7, scale: 4, default: 0, comment: "% phạt mỗi ngày trễ." })
  penaltyRatePctPerDay!: string;

  @Column({ name: "max_penalty_pct", type: "numeric", precision: 7, scale: 4, default: 0, comment: "Trần phạt (%)." })
  maxPenaltyPct!: string;

  @Column({ name: "release_rule_code", type: "text", comment: "Bộ luật chấm mốc này (khóa ngoại tới rule_scopes); chép từ mốc mẫu khi tạo hợp đồng." })
  releaseRuleCode!: string;

  @Column({ name: "initial_milestone_status", type: "text", default: "PLANNED", comment: "Trạng thái ban đầu." })
  initialMilestoneStatus!: string;

  @Column({ name: "data_is_synthetic", type: "boolean", default: true, comment: "Dữ liệu giả lập của đề." })
  dataIsSynthetic!: boolean;

  @ManyToOne(() => Contract, (contract) => contract.milestones, { onDelete: "RESTRICT", onUpdate: "CASCADE" })
  @JoinColumn({ name: "contract_id", referencedColumnName: "contractId", foreignKeyConstraintName: "milestones_contract_fkey" })
  contract!: Contract;

  @ManyToOne(() => RuleScope, { onDelete: "RESTRICT", onUpdate: "CASCADE" })
  @JoinColumn({ name: "release_rule_code", referencedColumnName: "releaseRuleCode", foreignKeyConstraintName: "milestones_rule_scope_fkey" })
  ruleScope!: RuleScope;
}
