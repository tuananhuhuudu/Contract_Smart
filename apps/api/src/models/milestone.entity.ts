import { Check, Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { BaseModel } from "./base.model";
import { Contract } from "./contract.entity";
import { MilestoneVersion } from "./milestone-version.entity";

/**
 * Table milestones: the real milestones of one contract, with money and dates. Each points at the
 * milestone version (conditions + rules) it is judged by: the shared version in use when the
 * contract was created, or a custom version made for this contract. They can change only while
 * the contract is DRAFT (trigger).
 */
@Entity({ name: "milestones", comment: "Mốc thật của hợp đồng: tiền, hạn và phiên bản luật dùng để chấm. Chỉ sửa được khi hợp đồng DRAFT." })
@Index("milestones_position_key", ["contractId", "position"], { unique: true })
@Check("milestones_position_check", `"position" >= 1`)
@Check("milestones_amount_check", `"amount_vnd_mn" > 0`)
export class Milestone extends BaseModel {
  @PrimaryGeneratedColumn({ comment: "Mã mốc (tự sinh)." })
  id!: number;

  @Column({ name: "contract_id", type: "integer", comment: "Mốc thuộc hợp đồng nào (contracts.id)." })
  contractId!: number;

  @Column({ type: "integer", comment: "Thứ tự mốc trong hợp đồng: 1, 2, 3 (theo hạn)." })
  position!: number;

  @Column({ name: "milestone_version_id", type: "integer", comment: "Phiên bản mốc dùng để chấm (milestone_versions.id); tên mốc lấy qua đây." })
  milestoneVersionId!: number;

  @Column({ name: "amount_vnd_mn", type: "numeric", precision: 18, scale: 2, comment: "Tiền của mốc (triệu VND) = % x giá trị hợp đồng." })
  amountVndMn!: string;

  @Column({ name: "due_on", type: "date", comment: "Hạn của mốc." })
  dueOn!: string;

  @ManyToOne(() => Contract, (contract) => contract.milestones, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "contract_id", foreignKeyConstraintName: "milestones_contract_fkey" })
  contract!: Contract;

  @ManyToOne(() => MilestoneVersion, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "milestone_version_id", foreignKeyConstraintName: "milestones_version_fkey" })
  milestoneVersion!: MilestoneVersion;
}
