import { Check, Column, Entity, JoinColumn, ManyToOne, PrimaryColumn, Unique } from "typeorm";
import { BaseModel, ORIGIN_CHECK } from "./base.model";
import { ContractType } from "./contract-type.entity";

/**
 * Table rule_scopes: the name of a rule set for one milestone type of one contract type
 * (R_GOODS_STD:DELIVERY). It holds no rules itself; payment_rules rows point at it.
 */
@Entity({
  name: "rule_scopes",
  comment:
    "Tên một bộ luật cho một loại mốc của một loại hợp đồng (ví dụ R_GOODS_STD:DELIVERY). Không chứa luật: các luật là dòng payment_rules trỏ về đây.",
})
// One rule set per milestone type within a contract type.
@Unique("rule_scopes_contract_type_milestone_type_key", ["contractType", "milestoneType"])
// Lets a later table point at (contract type, rule set) together, so it only picks a rule set of
// its own contract type.
@Unique("rule_scopes_contract_type_release_rule_code_key", ["contractType", "releaseRuleCode"])
@Check("rule_scopes_code_check", `"release_rule_code" ~ '^[A-Z][A-Z0-9_]*:[A-Z][A-Z0-9_]*$'`)
@Check("rule_scopes_milestone_type_check", `"milestone_type" ~ '^[A-Z][A-Z0-9_]*$'`)
@Check("rule_scopes_name_check", `length(trim("name")) > 0`)
@Check("rule_scopes_origin_check", ORIGIN_CHECK)
export class RuleScope extends BaseModel {
  @PrimaryColumn({
    name: "release_rule_code",
    type: "text",
    comment: "Mã bộ luật, dạng <bộ luật của loại>:<loại mốc>, ví dụ R_GOODS_STD:DELIVERY.",
  })
  releaseRuleCode!: string;

  @Column({ name: "contract_type", type: "text", comment: "Loại hợp đồng của bộ luật (khóa ngoại tới contract_types)." })
  contractType!: string;

  @Column({
    name: "milestone_type",
    type: "text",
    comment: "Loại mốc mà bộ luật này chấm, ví dụ DELIVERY. Mỗi loại hợp đồng có tối đa một bộ cho mỗi loại mốc.",
  })
  milestoneType!: string;

  @Column({ type: "text", comment: "Tên hiển thị, ví dụ Giao hàng - hàng hóa." })
  name!: string;

  @ManyToOne(() => ContractType, (type) => type.ruleScopes, { onDelete: "RESTRICT", onUpdate: "CASCADE" })
  @JoinColumn({ name: "contract_type", referencedColumnName: "code", foreignKeyConstraintName: "rule_scopes_contract_type_fkey" })
  type!: ContractType;
}
