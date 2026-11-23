import { Check, Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from "typeorm";
import { BaseModel, ORIGIN_CHECK } from "./base.model";

/** Table parties (Data Pack columns): buyers, suppliers and the buyers' approvers. */
@Entity({ name: "parties", comment: "Các bên tham gia: bên mua, nhà cung cấp, người phê duyệt của bên mua." })
@Check("parties_type_check", `"party_type" IN ('BUYER', 'SUPPLIER', 'APPROVER')`)
// An approver belongs to a buyer; buyers and suppliers have no parent.
@Check("parties_parent_check", `("party_type" = 'APPROVER') = ("parent_party_id" IS NOT NULL)`)
@Check("parties_approval_role_check", `"approval_role" IN ('NONE', 'CONTRACT_OWNER', 'FINANCE_APPROVER', 'SECONDARY_APPROVER')`)
@Check("parties_approval_level_check", `"approval_level" >= 0`)
@Check("parties_limit_check", `"approval_limit_vnd_mn" >= 0`)
@Check("parties_status_check", `"status" IN ('ACTIVE', 'INACTIVE')`)
@Check("parties_origin_check", ORIGIN_CHECK)
export class Party extends BaseModel {
  @PrimaryColumn({ name: "party_id", type: "text", comment: "Mã bên: Bxxx bên mua, Sxxx nhà cung cấp, Axxx người phê duyệt." })
  partyId!: string;

  @Column({ name: "party_name", type: "text", comment: "Tên của bên." })
  partyName!: string;

  @Column({ name: "party_type", type: "text", comment: "BUYER, SUPPLIER hoặc APPROVER." })
  partyType!: string;

  @Column({ name: "parent_party_id", type: "text", nullable: true, comment: "Bên mua mà người phê duyệt thuộc về; NULL với bên mua và nhà cung cấp." })
  parentPartyId!: string | null;

  @Column({ name: "organization_category", type: "text", comment: "Lĩnh vực hoạt động." })
  organizationCategory!: string;

  @Column({ type: "text", comment: "Khu vực, ví dụ HANOI." })
  region!: string;

  @Column({ type: "text", default: "VN", comment: "Mã quốc gia." })
  country!: string;

  @Column({ name: "approval_role", type: "text", default: "NONE", comment: "Vai trò phê duyệt; NONE với bên mua và nhà cung cấp." })
  approvalRole!: string;

  @Column({ name: "approval_level", type: "integer", default: 0, comment: "Cấp phê duyệt (0, 1, 2)." })
  approvalLevel!: number;

  @Column({ name: "approval_limit_vnd_mn", type: "numeric", precision: 18, scale: 2, nullable: true, comment: "Hạn mức được duyệt (triệu VND)." })
  approvalLimitVndMn!: string | null;

  @Column({ name: "allowed_event_types", type: "text", array: true, default: () => "'{}'", comment: "Các loại sự kiện bên này được ghi." })
  allowedEventTypes!: string[];

  @Column({ name: "can_approve_payment", type: "boolean", default: false, comment: "Được duyệt thanh toán không." })
  canApprovePayment!: boolean;

  @Column({ name: "can_raise_dispute", type: "boolean", default: false, comment: "Được mở tranh chấp không." })
  canRaiseDispute!: boolean;

  @Column({ type: "text", default: "ACTIVE", comment: "ACTIVE hoặc INACTIVE." })
  status!: string;

  @Column({ name: "data_is_synthetic", type: "boolean", default: true, comment: "Dữ liệu giả lập của đề." })
  dataIsSynthetic!: boolean;

  @ManyToOne(() => Party, { nullable: true, onDelete: "RESTRICT", onUpdate: "CASCADE" })
  @JoinColumn({ name: "parent_party_id", referencedColumnName: "partyId", foreignKeyConstraintName: "parties_parent_fkey" })
  parent!: Party | null;
}
