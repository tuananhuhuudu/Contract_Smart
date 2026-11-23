import { Check, Column, Entity, Index, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { BaseModel } from "./base.model";
import { ContractTypeMilestone } from "./contract-type-milestone.entity";

/** Table contract_types: kinds of contract (Cung cấp hàng hóa, Tư vấn...), each built from library milestones. */
@Entity({ name: "contract_types", comment: "Loại hợp đồng. Khuôn mốc nằm ở contract_type_milestones." })
@Index("contract_types_name_key", ["name"], { unique: true })
@Check("contract_types_name_check", `length(trim("name")) > 0`)
export class ContractType extends BaseModel {
  @PrimaryGeneratedColumn({ comment: "Mã loại hợp đồng (tự sinh)." })
  id!: number;

  @Column({ type: "text", comment: "Tên loại, ví dụ Tư vấn." })
  name!: string;

  @Column({ type: "boolean", default: true, comment: "FALSE: không tạo được hợp đồng mới loại này." })
  active!: boolean;

  @OneToMany(() => ContractTypeMilestone, (row) => row.contractType)
  milestones!: ContractTypeMilestone[];
}
