import { Check, Column, Entity, OneToMany, PrimaryColumn } from "typeorm";
import { BaseModel } from "./base.model";
import { PaymentRule } from "./payment-rule.entity";

/**
 * Table rule_versions: a version of all payment rules. Contracts keep the version they were created
 * with; rules of a published version cannot change (trigger), edits go into a new DRAFT version.
 */
@Entity({
  name: "rule_versions",
  comment: "Phiên bản luật. Hợp đồng giữ phiên bản lúc tạo; luật của phiên bản đã công bố không sửa được, muốn đổi thì tạo phiên bản DRAFT mới.",
})
@Check("rule_versions_status_check", `"status" IN ('DRAFT', 'PUBLISHED', 'RETIRED')`)
// A draft has not been published; a published or retired version says when.
@Check("rule_versions_published_check", `("status" = 'DRAFT') = ("published_at" IS NULL)`)
// Two people: whoever wrote the version does not publish it.
@Check("rule_versions_two_people_check", `"published_by" IS NULL OR "created_by" IS NULL OR "published_by" <> "created_by"`)
@Check("rule_versions_name_check", `length(trim("name")) > 0`)
export class RuleVersion extends BaseModel {
  @PrimaryColumn({ type: "text", comment: "Mã phiên bản, ví dụ v1." })
  id!: string;

  @Column({ type: "text", comment: "Tên phiên bản, ví dụ Data Pack." })
  name!: string;

  @Column({
    type: "text",
    default: "DRAFT",
    comment: "DRAFT (đang soạn, sửa được) -> PUBLISHED (đang dùng, khóa) -> RETIRED (ngừng dùng cho hợp đồng mới).",
  })
  status!: string;

  @Column({ type: "text", nullable: true, comment: "Ghi chú thay đổi của phiên bản." })
  note!: string | null;

  // Foreign keys to users are added with the users table.
  @Column({ name: "created_by", type: "uuid", nullable: true, comment: "Người soạn; NULL với phiên bản của Data Pack." })
  createdBy!: string | null;

  @Column({ name: "published_by", type: "uuid", nullable: true, comment: "Người công bố; phải khác người soạn." })
  publishedBy!: string | null;

  @Column({ name: "published_at", type: "timestamptz", nullable: true, comment: "Thời điểm công bố." })
  publishedAt!: Date | null;

  @OneToMany(() => PaymentRule, (rule) => rule.ruleVersion)
  rules!: PaymentRule[];
}
