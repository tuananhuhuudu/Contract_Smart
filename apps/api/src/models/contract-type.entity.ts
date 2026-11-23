import { Check, Column, Entity, OneToMany, PrimaryColumn, Unique } from "typeorm";
import { BaseModel, ORIGIN_CHECK } from "./base.model";
import { RuleScope } from "./rule-scope.entity";

/** Table contract_types: a kind of contract (goods, services...), with one template and one rule set. */
@Entity({
  name: "contract_types",
  comment: "Loại hợp đồng (hàng hóa, dịch vụ...). Mỗi loại có một khuôn mốc và một bộ luật.",
})
// Target of the composite key on contracts: type, template and rule set belong together.
@Unique("contract_types_code_template_rule_set_key", ["code", "workflowTemplate", "ruleSetId"])
@Check("contract_types_code_check", `"code" ~ '^[A-Z][A-Z0-9_]*$'`)
@Check("contract_types_name_check", `length(trim("name")) > 0`)
@Check("contract_types_origin_check", ORIGIN_CHECK)
export class ContractType extends BaseModel {
  @PrimaryColumn({ type: "text", comment: "Mã loại hợp đồng, chữ hoa và gạch dưới, ví dụ GOODS_SUPPLY." })
  code!: string;

  @Column({ type: "text", comment: "Tên hiển thị, ví dụ Cung cấp hàng hóa." })
  name!: string;

  @Column({ name: "workflow_template", type: "text", unique: true, comment: "Mã khuôn mốc, ví dụ WF_GOODS_4STAGE." })
  workflowTemplate!: string;

  @Column({ name: "rule_set_id", type: "text", unique: true, comment: "Mã bộ luật của loại, ví dụ R_GOODS_STD." })
  ruleSetId!: string;

  @Column({ type: "boolean", default: true, comment: "FALSE: không tạo hợp đồng mới thuộc loại này được nữa." })
  active!: boolean;

  @OneToMany(() => RuleScope, (scope) => scope.type)
  ruleScopes!: RuleScope[];
}
