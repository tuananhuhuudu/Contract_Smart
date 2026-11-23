import { Check, Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { BaseModel } from "./base.model";
import { ContractType } from "./contract-type.entity";
import { Milestone } from "./milestone.entity";
import { Party } from "./party.entity";

export const CONTRACT_STATUSES = ["DRAFT", "ACTIVE", "CLOSED"] as const;
export type ContractStatus = (typeof CONTRACT_STATUSES)[number];
/** Who must approve a milestone before it is paid (the engine reads it as approval_required and the quorum). */
export const APPROVAL_POLICIES = ["AUTO_IF_ALL_CONDITIONS", "SINGLE_BUYER_APPROVAL", "DUAL_APPROVAL", "FINANCE_PLUS_OWNER"] as const;
export type ApprovalPolicy = (typeof APPROVAL_POLICIES)[number];

const list = (values: readonly string[]): string => values.map((v) => `'${v}'`).join(", ");

/**
 * Table contracts: one agreement between a buyer and a supplier, created from a contract type.
 * While DRAFT (negotiating) its terms and milestones can change; activating it locks everything
 * (trigger) and from then on events are recorded against its milestones.
 */
@Entity({ name: "contracts", comment: "Hợp đồng. DRAFT: đang đàm phán, chỉnh được; ACTIVE: đã ký, khóa, ghi sự kiện; CLOSED: đã đóng." })
@Check("contracts_title_check", `length(trim("title")) > 0`)
@Check("contracts_parties_check", `"buyer_id" <> "supplier_id"`)
@Check("contracts_value_check", `"value_vnd_mn" > 0`)
@Check("contracts_dates_check", `"start_on" <= "end_on"`)
@Check("contracts_policy_check", `"approval_policy" IN (${list(APPROVAL_POLICIES)})`)
@Check("contracts_terms_check", `"grace_days" >= 0 AND "penalty_pct_per_day" >= 0 AND "max_penalty_pct" >= 0 AND "max_penalty_pct" <= 100`)
@Check("contracts_status_check", `"status" IN (${list(CONTRACT_STATUSES)})`)
export class Contract extends BaseModel {
  @PrimaryGeneratedColumn({ comment: "Mã hợp đồng (tự sinh)." })
  id!: number;

  @Column({ type: "text", comment: "Tên hợp đồng." })
  title!: string;

  @Column({ name: "contract_type_id", type: "integer", comment: "Loại hợp đồng (contract_types.id) dùng làm khuôn lúc tạo." })
  contractTypeId!: number;

  @Column({ name: "buyer_id", type: "integer", comment: "Bên mua (parties.id, loại BUYER)." })
  buyerId!: number;

  @Column({ name: "supplier_id", type: "integer", comment: "Nhà cung cấp (parties.id, loại SUPPLIER)." })
  supplierId!: number;

  @Column({ name: "value_vnd_mn", type: "numeric", precision: 18, scale: 2, comment: "Giá trị hợp đồng (triệu VND); 1000.00 = 1 tỷ đồng." })
  valueVndMn!: string;

  @Column({ name: "start_on", type: "date", comment: "Ngày bắt đầu; hạn của mốc tính từ ngày này." })
  startOn!: string;

  @Column({ name: "end_on", type: "date", comment: "Ngày kết thúc." })
  endOn!: string;

  @Column({ name: "approval_policy", type: "text", comment: "Chính sách duyệt: AUTO_IF_ALL_CONDITIONS, SINGLE_BUYER_APPROVAL, DUAL_APPROVAL, FINANCE_PLUS_OWNER." })
  approvalPolicy!: ApprovalPolicy;

  @Column({ name: "grace_days", type: "integer", comment: "Số ngày ân hạn sau hạn mốc trước khi tính trễ." })
  graceDays!: number;

  @Column({ name: "penalty_pct_per_day", type: "numeric", precision: 7, scale: 4, comment: "Phạt mỗi ngày trễ (% tiền mốc), ví dụ 0.1000." })
  penaltyPctPerDay!: string;

  @Column({ name: "max_penalty_pct", type: "numeric", precision: 7, scale: 4, comment: "Trần phạt (% tiền mốc), ví dụ 8.0000." })
  maxPenaltyPct!: string;

  @Column({ type: "text", default: "DRAFT", comment: "DRAFT -> ACTIVE -> CLOSED." })
  status!: ContractStatus;

  @ManyToOne(() => ContractType, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "contract_type_id", foreignKeyConstraintName: "contracts_type_fkey" })
  contractType!: ContractType;

  @ManyToOne(() => Party, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "buyer_id", foreignKeyConstraintName: "contracts_buyer_fkey" })
  buyer!: Party;

  @ManyToOne(() => Party, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "supplier_id", foreignKeyConstraintName: "contracts_supplier_fkey" })
  supplier!: Party;

  @OneToMany(() => Milestone, (milestone) => milestone.contract)
  milestones!: Milestone[];
}
