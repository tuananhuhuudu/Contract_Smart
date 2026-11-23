import { Check, Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { BaseModel } from "./base.model";
import { MilestoneLibrary } from "./milestone-library.entity";
import { PaymentRule } from "./payment-rule.entity";

export const VERSION_STATUSES = ["DRAFT", "PUBLISHED", "RETIRED"] as const;
export type VersionStatus = (typeof VERSION_STATUSES)[number];

/**
 * Table milestone_versions: one edit of a milestone's conditions and rules. A DRAFT can change;
 * publishing locks it (trigger) and retires the previous shared version. Contracts point at the
 * version they were signed with. is_custom marks a version made for one contract only: it never
 * shows in the library, and its contract is found through the milestone that uses it.
 */
@Entity({ name: "milestone_versions", comment: "Phiên bản điều kiện + luật của một mốc. Đã công bố thì khóa; muốn sửa thì tạo phiên bản mới." })
// Shared versions are numbered per milestone; custom versions (one contract) are not counted.
@Index("milestone_versions_number_key", ["milestoneId", "versionNo"], { unique: true, where: `NOT "is_custom"` })
// At most one shared version of a milestone is in use at a time.
@Index("milestone_versions_one_published_key", ["milestoneId"], { unique: true, where: `"status" = 'PUBLISHED' AND NOT "is_custom"` })
@Check("milestone_versions_status_check", `"status" IN ('DRAFT', 'PUBLISHED', 'RETIRED')`)
@Check("milestone_versions_number_check", `"version_no" >= 1`)
// A draft has not been published; a published or retired version says when.
@Check("milestone_versions_published_check", `("status" = 'DRAFT') = ("published_at" IS NULL)`)
export class MilestoneVersion extends BaseModel {
  @PrimaryGeneratedColumn({ comment: "Mã phiên bản (tự sinh)." })
  id!: number;

  @Column({ name: "milestone_id", type: "integer", comment: "Phiên bản của mốc nào (milestone_library.id)." })
  milestoneId!: number;

  @Column({ name: "is_custom", type: "boolean", default: false, comment: "FALSE: phiên bản chung trong thư viện; TRUE: luật riêng của một hợp đồng (tìm hợp đồng qua milestones)." })
  isCustom!: boolean;

  @Column({ name: "version_no", type: "integer", comment: "Số phiên bản của mốc: 1, 2, 3..." })
  versionNo!: number;

  @Column({ type: "text", default: "DRAFT", comment: "DRAFT (đang soạn, sửa được) -> PUBLISHED (đang dùng, khóa) -> RETIRED (ngừng dùng cho hợp đồng mới)." })
  status!: VersionStatus;

  @Column({ name: "required_event_type_ids", type: "integer", array: true, default: () => "'{}'", comment: "Sự kiện bắt buộc (event_types.id): phải có đủ mới được trả tiền." })
  requiredEventTypeIds!: number[];

  @Column({ name: "late_penalty", type: "boolean", default: false, comment: "Trễ hạn có bị phạt không (luật phạt trễ đọc cờ này)." })
  latePenalty!: boolean;

  @Column({ type: "text", nullable: true, comment: "Lần sửa này đổi gì." })
  note!: string | null;

  @Column({ name: "published_at", type: "timestamptz", nullable: true, comment: "Thời điểm công bố." })
  publishedAt!: Date | null;

  @ManyToOne(() => MilestoneLibrary, (milestone) => milestone.versions, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "milestone_id", foreignKeyConstraintName: "milestone_versions_milestone_fkey" })
  milestone!: MilestoneLibrary;

  @OneToMany(() => PaymentRule, (rule) => rule.milestoneVersion)
  rules!: PaymentRule[];
}
