import { Check, Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { BaseModel } from "./base.model";

export const PARTY_TYPES = ["BUYER", "SUPPLIER", "APPROVER"] as const;
export type PartyType = (typeof PARTY_TYPES)[number];
export const APPROVAL_ROLES = ["CONTRACT_OWNER", "FINANCE_APPROVER", "SECONDARY_APPROVER"] as const;

const list = (values: readonly string[]): string => values.map((v) => `'${v}'`).join(", ");

/**
 * Table parties: buyers, suppliers and the buyers' approvers. A party is a company or a role in a
 * contract, not a login (see users). allowed_event_type_ids lists the event types it may record;
 * the engine uses it to spot evidence recorded by the wrong party. The API checks each id exists.
 */
@Entity({ name: "parties", comment: "Các bên: bên mua, nhà cung cấp, người phê duyệt của bên mua." })
@Index("parties_name_key", ["name"], { unique: true })
@Check("parties_name_check", `length(trim("name")) > 0`)
@Check("parties_type_check", `"type" IN (${list(PARTY_TYPES)})`)
// An approver belongs to a buyer and has an approval role; buyers and suppliers have neither.
@Check("parties_parent_check", `("type" = 'APPROVER') = ("parent_id" IS NOT NULL)`)
@Check("parties_approval_role_check", `("type" = 'APPROVER') = ("approval_role" IS NOT NULL) AND ("approval_role" IS NULL OR "approval_role" IN (${list(APPROVAL_ROLES)}))`)
@Check("parties_limit_check", `"approval_limit_vnd_mn" IS NULL OR ("type" = 'APPROVER' AND "approval_limit_vnd_mn" >= 0)`)
export class Party extends BaseModel {
  @PrimaryGeneratedColumn({ comment: "Mã bên (tự sinh)." })
  id!: number;

  @Column({ type: "text", comment: "Tên của bên, ví dụ Nova An Business JSC." })
  name!: string;

  @Column({ type: "text", comment: "BUYER (bên mua), SUPPLIER (nhà cung cấp) hoặc APPROVER (người phê duyệt)." })
  type!: PartyType;

  @Column({ name: "parent_id", type: "integer", nullable: true, comment: "Bên mua mà người phê duyệt thuộc về; NULL với bên mua và nhà cung cấp." })
  parentId!: number | null;

  @Column({ name: "approval_role", type: "text", nullable: true, comment: "Vai trò duyệt: CONTRACT_OWNER, FINANCE_APPROVER, SECONDARY_APPROVER; chỉ với người phê duyệt." })
  approvalRole!: (typeof APPROVAL_ROLES)[number] | null;

  @Column({ name: "approval_limit_vnd_mn", type: "numeric", precision: 18, scale: 2, nullable: true, comment: "Hạn mức được duyệt (triệu VND); chỉ với người phê duyệt." })
  approvalLimitVndMn!: string | null;

  @Column({ name: "allowed_event_type_ids", type: "integer", array: true, default: () => "'{}'", comment: "Các loại sự kiện (event_types.id) bên này được ghi." })
  allowedEventTypeIds!: number[];

  @Column({ type: "boolean", default: true, comment: "FALSE: không chọn được cho hợp đồng mới." })
  active!: boolean;

  @ManyToOne(() => Party, { nullable: true, onDelete: "RESTRICT" })
  @JoinColumn({ name: "parent_id", foreignKeyConstraintName: "parties_parent_fkey" })
  parent!: Party | null;
}
