import { Check, Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn, Unique } from "typeorm";
import { BaseModel } from "./base.model";
import { Contract } from "./contract.entity";
import { RuleScope } from "./rule-scope.entity";

/**
 * Table milestones (Data Pack columns): one payment stage of one contract, with its amount, due
 * date, required events and the rule set that evaluates it. Generated from contract_type_stages
 * when a contract is created; after that it no longer depends on the template. Values the Data Pack
 * repeats from the contract (approvals, grace, penalty...) are rebuilt by the view engine_milestones.
 */
@Entity({ name: "milestones", comment: "Mốc thanh toán thật của một hợp đồng: số tiền, hạn, điều kiện và bộ luật dùng để chấm." })
@Unique("milestones_contract_sequence_key", ["contractId", "milestoneSequence"])
@Index("milestones_release_rule_code_idx", ["releaseRuleCode"])
@Check("milestones_sequence_check", `"milestone_sequence" >= 1`)
@Check("milestones_amount_check", `"planned_payment_vnd_mn" >= 0`)
export class Milestone extends BaseModel {
  @PrimaryColumn({ name: "milestone_id", type: "text", comment: "Mã mốc, ví dụ MS0002." })
  milestoneId!: string;

  @Column({ name: "contract_id", type: "text", comment: "Hợp đồng chứa mốc (khóa ngoại tới contracts)." })
  contractId!: string;

  @Column({ name: "milestone_sequence", type: "integer", comment: "Thứ tự mốc trong hợp đồng (1, 2, 3...)." })
  milestoneSequence!: number;


  @Column({ name: "milestone_name", type: "text", comment: "Tên hiển thị của mốc." })
  milestoneName!: string;

  @Column({ name: "due_date", type: "date", comment: "Hạn hoàn thành mốc." })
  dueDate!: string;


  @Column({ name: "planned_payment_vnd_mn", type: "numeric", precision: 18, scale: 2, comment: "Số tiền dự kiến trả (triệu VND)." })
  plannedPaymentVndMn!: string;


  @Column({ name: "required_event_types", type: "text", array: true, comment: "Sự kiện bắt buộc, ví dụ {DELIVERY, INVOICE}." })
  requiredEventTypes!: string[];


  @Column({ name: "invoice_required", type: "boolean", default: false, comment: "Mốc có cần hóa đơn không." })
  invoiceRequired!: boolean;





  @Column({ name: "late_penalty_applicable", type: "boolean", default: false, comment: "Mốc có tính phạt trễ không." })
  latePenaltyApplicable!: boolean;




  @Column({ name: "release_rule_code", type: "text", comment: "Bộ luật chấm mốc này (khóa ngoại tới rule_scopes); chép từ mốc mẫu khi tạo hợp đồng." })
  releaseRuleCode!: string;



  @ManyToOne(() => Contract, (contract) => contract.milestones, { onDelete: "RESTRICT", onUpdate: "CASCADE" })
  @JoinColumn({ name: "contract_id", referencedColumnName: "contractId", foreignKeyConstraintName: "milestones_contract_fkey" })
  contract!: Contract;

  @ManyToOne(() => RuleScope, { onDelete: "RESTRICT", onUpdate: "CASCADE" })
  @JoinColumn({ name: "release_rule_code", referencedColumnName: "releaseRuleCode", foreignKeyConstraintName: "milestones_rule_scope_fkey" })
  ruleScope!: RuleScope;
}
