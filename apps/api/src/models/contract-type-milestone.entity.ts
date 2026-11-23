import { Check, Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { BaseModel } from "./base.model";
import { ContractType } from "./contract-type.entity";
import { MilestoneLibrary } from "./milestone-library.entity";

/**
 * Table contract_type_milestones: the template of a contract type, i.e. which library milestones
 * it has, what share of the contract value each pays and when each is due. Creating a contract
 * turns these rows into real milestones (money and dates); changing the template later does not
 * touch contracts already created.
 */
@Entity({ name: "contract_type_milestones", comment: "Khuôn của loại hợp đồng: gồm mốc nào trong thư viện, bao nhiêu %, hạn bao lâu." })
@Index("contract_type_milestones_position_key", ["contractTypeId", "position"], { unique: true })
@Index("contract_type_milestones_milestone_key", ["contractTypeId", "milestoneId"], { unique: true })
@Check("contract_type_milestones_position_check", `"position" >= 1`)
@Check("contract_type_milestones_percent_check", `"payment_percent" > 0 AND "payment_percent" <= 100`)
@Check("contract_type_milestones_days_check", `"due_after_days" >= 0`)
export class ContractTypeMilestone extends BaseModel {
  @PrimaryGeneratedColumn({ comment: "Mã dòng khuôn (tự sinh)." })
  id!: number;

  @Column({ name: "contract_type_id", type: "integer", comment: "Loại hợp đồng (contract_types.id)." })
  contractTypeId!: number;

  @Column({ type: "integer", comment: "Thứ tự mốc trong loại hợp đồng: 1, 2, 3 (theo hạn)." })
  position!: number;

  @Column({ name: "milestone_id", type: "integer", comment: "Mốc trong thư viện (milestone_library.id)." })
  milestoneId!: number;

  @Column({ name: "payment_percent", type: "numeric", precision: 5, scale: 2, comment: "Phần trăm giá trị hợp đồng của mốc, ví dụ 40.00; tổng các mốc = 100 mới tạo được hợp đồng." })
  paymentPercent!: string;

  @Column({ name: "due_after_days", type: "integer", comment: "Hạn = ngày bắt đầu hợp đồng + số ngày." })
  dueAfterDays!: number;

  @ManyToOne(() => ContractType, (type) => type.milestones, { onDelete: "CASCADE" })
  @JoinColumn({ name: "contract_type_id", foreignKeyConstraintName: "contract_type_milestones_type_fkey" })
  contractType!: ContractType;

  @ManyToOne(() => MilestoneLibrary, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "milestone_id", foreignKeyConstraintName: "contract_type_milestones_milestone_fkey" })
  milestone!: MilestoneLibrary;
}
