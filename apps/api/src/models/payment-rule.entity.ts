import { Check, Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn, Unique } from "typeorm";
import { BaseModel } from "./base.model";
import { RuleScope } from "./rule-scope.entity";
import { RuleVersion } from "./rule-version.entity";

/**
 * Table payment_rules: one "if ... then ..." rule. The engine takes the rules of the milestone's
 * rule set in the contract's rule version, by ascending priority; the first match wins. Columns that
 * describe the rule set (contract type, template...) come from rule_scopes via the view engine_payment_rules.
 */
@Entity({
  name: "payment_rules",
  comment: "Luật thanh toán: điều kiện -> quyết định. Engine xét các luật cùng bộ và cùng phiên bản theo priority tăng dần, luật đầu tiên khớp thắng.",
})
// Within one version, one rule per priority in each rule set.
@Unique("payment_rules_version_scope_priority_key", ["ruleVersionId", "releaseRuleCode", "priority"])
@Index("payment_rules_release_rule_code_idx", ["releaseRuleCode"])
@Check("payment_rules_group_check", `"rule_group" IN ('BLOCKING', 'VALIDATION', 'PENALTY', 'RELEASE', 'FALLBACK')`)
@Check("payment_rules_decision_check", `"decision" IN ('RELEASE', 'HOLD', 'REJECT', 'PENALTY')`)
@Check("payment_rules_priority_check", `"priority" > 0`)
export class PaymentRule extends BaseModel {
  @PrimaryColumn({ name: "rule_id", type: "text", comment: "Mã luật duy nhất, ví dụ PR0015." })
  ruleId!: string;

  @Column({ name: "rule_version_id", type: "text", comment: "Phiên bản luật chứa luật này." })
  ruleVersionId!: string;


  @Column({ name: "release_rule_code", type: "text", comment: "Bộ luật (rule_scopes) của luật, ví dụ R_GOODS_STD:DELIVERY." })
  releaseRuleCode!: string;




  @Column({ type: "integer", comment: "Độ ưu tiên; số nhỏ được xét trước." })
  priority!: number;


  @Column({ name: "rule_name", type: "text", comment: "Tên ngắn của luật." })
  ruleName!: string;

  @Column({ name: "rule_group", type: "text", comment: "Nhóm: BLOCKING, VALIDATION, PENALTY, RELEASE, FALLBACK." })
  ruleGroup!: string;

  @Column({ name: "condition_expression", type: "text", comment: "Điều kiện, ví dụ open_dispute == TRUE; ELSE cho luật cuối." })
  conditionExpression!: string;

  @Column({ type: "text", comment: "Quyết định khi khớp: RELEASE, HOLD, REJECT, PENALTY." })
  decision!: string;

  @Column({ name: "reason_code", type: "text", comment: "Mã lý do, ví dụ OPEN_DISPUTE." })
  reasonCode!: string;


  @Column({ name: "payable_amount_formula", type: "text", comment: "Công thức số tiền được trả (triệu VND)." })
  payableAmountFormula!: string;

  @Column({ name: "penalty_amount_formula", type: "text", comment: "Công thức tiền phạt (triệu VND)." })
  penaltyAmountFormula!: string;


  @Column({ name: "rule_description_vi", type: "text", comment: "Mô tả luật bằng tiếng Việt." })
  ruleDescriptionVi!: string;

  @Column({ type: "boolean", default: true, comment: "Luật đang được dùng." })
  active!: boolean;


  @ManyToOne(() => RuleVersion, (version) => version.rules, { onDelete: "RESTRICT", onUpdate: "CASCADE" })
  @JoinColumn({ name: "rule_version_id", referencedColumnName: "id", foreignKeyConstraintName: "payment_rules_rule_version_fkey" })
  ruleVersion!: RuleVersion;

  @ManyToOne(() => RuleScope, { onDelete: "RESTRICT", onUpdate: "CASCADE" })
  @JoinColumn({ name: "release_rule_code", referencedColumnName: "releaseRuleCode", foreignKeyConstraintName: "payment_rules_rule_scope_fkey" })
  ruleScope!: RuleScope;
}
