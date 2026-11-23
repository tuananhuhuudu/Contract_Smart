import { Check, Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from "typeorm";
import { BaseModel } from "./base.model";
import { ContractType } from "./contract-type.entity";
import { RuleScope } from "./rule-scope.entity";

/** Table contract_type_stages: one stage of a contract type's template; milestones are generated from it. */
@Entity({
  name: "contract_type_stages",
  comment: "Mốc mẫu (khuôn) của một loại hợp đồng; tạo hợp đồng mới thì mỗi dòng sinh ra một mốc thật trong milestones.",
})
@Check("stages_sequence_check", `"sequence" >= 1`)
@Check("stages_percent_check", `"payment_percent" > 0 AND "payment_percent" <= 100`)
@Check("stages_events_check", `cardinality("required_event_types") >= 1`)
@Check("stages_offset_check", `"offset_days" >= 0`)
@Check("stages_name_check", `length(trim("name")) > 0`)
export class ContractTypeStage extends BaseModel {
  @PrimaryColumn({ name: "contract_type", type: "text", comment: "Loại hợp đồng của mốc mẫu." })
  contractType!: string;

  @PrimaryColumn({ type: "integer", comment: "Thứ tự mốc trong khuôn (1, 2, 3...)." })
  sequence!: number;

  @Column({ name: "milestone_type", type: "text", comment: "Loại mốc, ví dụ DELIVERY." })
  milestoneType!: string;

  @Column({ type: "text", comment: "Tên mốc, ví dụ Giao hàng." })
  name!: string;

  /** numeric comes back from PostgreSQL as a string, so money and percentages never become floats. */
  @Column({
    name: "payment_percent",
    type: "numeric",
    precision: 5,
    scale: 2,
    comment: "% giá trị hợp đồng trả ở mốc này; tổng các mốc của một loại phải là 100 (API kiểm).",
  })
  paymentPercent!: string;

  @Column({
    name: "required_event_types",
    type: "text",
    array: true,
    comment: "Sự kiện bắt buộc để mốc được trả, ví dụ {DELIVERY, INVOICE}.",
  })
  requiredEventTypes!: string[];

  @Column({ name: "invoice_required", type: "boolean", default: false, comment: "Mốc có cần hóa đơn không." })
  invoiceRequired!: boolean;

  @Column({ name: "late_penalty_applicable", type: "boolean", default: false, comment: "Mốc có tính phạt trễ không." })
  latePenaltyApplicable!: boolean;

  @Column({
    name: "offset_days",
    type: "integer",
    default: 0,
    comment: "Hạn của mốc = ngày bắt đầu hợp đồng + số ngày này (người dùng sửa được trước khi chốt).",
  })
  offsetDays!: number;

  @Column({ name: "release_rule_code", type: "text", comment: "Bộ luật chấm mốc sinh ra từ dòng này; phải cùng loại hợp đồng." })
  releaseRuleCode!: string;

  @ManyToOne(() => ContractType, { onDelete: "RESTRICT", onUpdate: "CASCADE" })
  @JoinColumn({ name: "contract_type", referencedColumnName: "code", foreignKeyConstraintName: "stages_contract_type_fkey" })
  type!: ContractType;

  // Composite key (contract type, rule set): a stage may only use a rule set of its own contract type.
  @ManyToOne(() => RuleScope, { onDelete: "RESTRICT", onUpdate: "CASCADE" })
  @JoinColumn([
    { name: "contract_type", referencedColumnName: "contractType" },
    { name: "release_rule_code", referencedColumnName: "releaseRuleCode" },
  ])
  ruleScope!: RuleScope;
}
