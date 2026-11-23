import { Check, Column, Entity, Index, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { BaseModel } from "./base.model";
import { MilestoneVersion } from "./milestone-version.entity";

/**
 * Table milestone_library: the payment milestones people build once and reuse in any contract
 * type (Ký hợp đồng, Giao hàng, Nộp báo cáo...). Only the name lives here; conditions and rules
 * live in its versions, so editing them never changes a contract already signed.
 */
@Entity({ name: "milestone_library", comment: "Thư viện mốc thanh toán, dùng chung cho mọi loại hợp đồng. Điều kiện và luật nằm ở các phiên bản." })
@Index("milestone_library_name_key", ["name"], { unique: true })
@Check("milestone_library_name_check", `length(trim("name")) > 0`)
export class MilestoneLibrary extends BaseModel {
  @PrimaryGeneratedColumn({ comment: "Mã mốc (tự sinh)." })
  id!: number;

  @Column({ type: "text", comment: "Tên mốc, ví dụ Nộp báo cáo." })
  name!: string;

  @Column({ type: "boolean", default: true, comment: "FALSE: không chọn được cho loại hợp đồng mới; dữ liệu cũ vẫn giữ." })
  active!: boolean;

  @OneToMany(() => MilestoneVersion, (version) => version.milestone)
  versions!: MilestoneVersion[];
}
