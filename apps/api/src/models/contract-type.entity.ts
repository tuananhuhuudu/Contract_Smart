import { Check, Column, Entity, OneToMany, PrimaryColumn } from "typeorm";
import { BaseModel } from "./base.model";
import { RuleScope } from "./rule-scope.entity";

/**
 * Table contract_types: a kind of contract (goods, services...). Its template is the rows of
 * contract_type_stages, its rule sets the rows of rule_scopes; the Data Pack labels (template name,
 * rule set id) are rebuilt by the view contract_type_labels for the engine.
 */
@Entity({
  name: "contract_types",
  comment: "Loại hợp đồng (hàng hóa, dịch vụ...). Mỗi loại có một khuôn mốc và một bộ luật.",
})
@Check("contract_types_code_check", `"code" ~ '^[A-Z][A-Z0-9_]*$'`)
@Check("contract_types_name_check", `length(trim("name")) > 0`)
export class ContractType extends BaseModel {
  @PrimaryColumn({ type: "text", comment: "Mã loại hợp đồng, chữ hoa và gạch dưới, ví dụ GOODS_SUPPLY." })
  code!: string;

  @Column({ type: "text", comment: "Tên hiển thị, ví dụ Cung cấp hàng hóa." })
  name!: string;



  @Column({ type: "boolean", default: true, comment: "FALSE: không tạo hợp đồng mới thuộc loại này được nữa." })
  active!: boolean;

  @OneToMany(() => RuleScope, (scope) => scope.type)
  ruleScopes!: RuleScope[];
}
