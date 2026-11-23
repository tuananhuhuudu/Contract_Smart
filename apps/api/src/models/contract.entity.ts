import { Check, Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryColumn } from "typeorm";
import { BaseModel } from "./base.model";
import { ContractType } from "./contract-type.entity";
import { Milestone } from "./milestone.entity";
import { Party } from "./party.entity";
import { RuleVersion } from "./rule-version.entity";

/**
 * Table contracts: one contract between a buyer and a supplier. Columns the Data Pack repeats
 * (template, rule set, quorum, currency...) are not stored; the view engine_contracts rebuilds them.
 */
@Entity({ name: "contracts", comment: "Hợp đồng giữa bên mua và nhà cung cấp; tiền trả theo các mốc trong milestones." })
@Index("contracts_contract_type_idx", ["contractType"])
@Index("contracts_rule_version_idx", ["ruleVersionId"])
@Index("contracts_buyer_idx", ["buyerId"])
@Index("contracts_supplier_idx", ["supplierId"])
@Check("contracts_parties_check", `"buyer_id" <> "supplier_id"`)
@Check("contracts_value_check", `"contract_value_vnd_mn" >= 0`)
@Check("contracts_dates_check", `"start_date" >= "signing_date" AND "end_date" >= "start_date"`)
@Check("contracts_policy_check", `"approval_policy" IN ('AUTO_IF_ALL_CONDITIONS', 'SINGLE_BUYER_APPROVAL', 'DUAL_APPROVAL', 'FINANCE_PLUS_OWNER')`)
@Check("contracts_numbers_check", `"grace_period_days" >= 0 AND "penalty_rate_pct_per_day" >= 0 AND "max_penalty_pct" >= 0`)
@Check("contracts_lifecycle_check", `"lifecycle" IN ('DRAFT', 'SIGNING', 'ACTIVE', 'CLOSED')`)
export class Contract extends BaseModel {
  @PrimaryColumn({ name: "contract_id", type: "text", comment: "Mã hợp đồng, ví dụ CT0001." })
  contractId!: string;

  @Column({ name: "contract_title", type: "text", comment: "Tên hợp đồng." })
  contractTitle!: string;

  @Column({ name: "contract_type", type: "text", comment: "Loại hợp đồng (khóa ngoại tới contract_types); khuôn mốc và bộ luật lấy từ loại." })
  contractType!: string;

  @Column({ name: "buyer_id", type: "text", comment: "Bên mua (khóa ngoại tới parties)." })
  buyerId!: string;

  @Column({ name: "supplier_id", type: "text", comment: "Nhà cung cấp (khóa ngoại tới parties), khác bên mua." })
  supplierId!: string;

  @Column({ name: "contract_value_vnd_mn", type: "numeric", precision: 18, scale: 2, comment: "Giá trị hợp đồng (triệu VND)." })
  contractValueVndMn!: string;


  // PostgreSQL date columns come back as 'YYYY-MM-DD' strings: no time zone shifts.
  @Column({ name: "signing_date", type: "date", comment: "Ngày ký." })
  signingDate!: string;

  @Column({ name: "start_date", type: "date", comment: "Ngày bắt đầu (không sớm hơn ngày ký)." })
  startDate!: string;

  @Column({ name: "end_date", type: "date", comment: "Ngày kết thúc theo kế hoạch." })
  endDate!: string;



  @Column({ name: "rule_version_id", type: "text", comment: "Phiên bản luật dùng để chấm hợp đồng này; giữ nguyên khi có phiên bản mới." })
  ruleVersionId!: string;

  @Column({ name: "approval_policy", type: "text", comment: "Chính sách phê duyệt: tự động, một người, hai người..." })
  approvalPolicy!: string;



  @Column({ name: "grace_period_days", type: "integer", default: 0, comment: "Số ngày ân hạn trước khi tính phạt." })
  gracePeriodDays!: number;

  @Column({ name: "penalty_rate_pct_per_day", type: "numeric", precision: 7, scale: 4, default: 0, comment: "% phạt mỗi ngày trễ." })
  penaltyRatePctPerDay!: string;

  @Column({ name: "max_penalty_pct", type: "numeric", precision: 7, scale: 4, default: 0, comment: "Trần phạt tối đa (%)." })
  maxPenaltyPct!: string;



  @Column({ type: "text", default: "DRAFT", comment: "Vòng đời trong ứng dụng: DRAFT, SIGNING, ACTIVE, CLOSED." })
  lifecycle!: string;


  @ManyToOne(() => ContractType, { onDelete: "RESTRICT", onUpdate: "CASCADE" })
  @JoinColumn({ name: "contract_type", referencedColumnName: "code", foreignKeyConstraintName: "contracts_contract_type_fkey" })
  type!: ContractType;

  @ManyToOne(() => RuleVersion, { onDelete: "RESTRICT", onUpdate: "CASCADE" })
  @JoinColumn({ name: "rule_version_id", referencedColumnName: "id", foreignKeyConstraintName: "contracts_rule_version_fkey" })
  ruleVersion!: RuleVersion;

  @ManyToOne(() => Party, { onDelete: "RESTRICT", onUpdate: "CASCADE" })
  @JoinColumn({ name: "buyer_id", referencedColumnName: "partyId", foreignKeyConstraintName: "contracts_buyer_fkey" })
  buyer!: Party;

  @ManyToOne(() => Party, { onDelete: "RESTRICT", onUpdate: "CASCADE" })
  @JoinColumn({ name: "supplier_id", referencedColumnName: "partyId", foreignKeyConstraintName: "contracts_supplier_fkey" })
  supplier!: Party;

  @OneToMany(() => Milestone, (milestone) => milestone.contract)
  milestones!: Milestone[];
}
