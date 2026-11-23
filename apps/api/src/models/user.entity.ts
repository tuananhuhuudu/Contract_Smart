import { Check, Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { BaseModel } from "./base.model";
import { Party } from "./party.entity";

/** Roles that work for a party (a buyer, one of its approvers, or a supplier). */
export const PARTY_ROLES = [
  "CONTRACT_OWNER",
  "LEGAL_REVIEWER",
  "FINANCE_APPROVER",
  "SECONDARY_APPROVER",
  "ADMIN_AUDITOR",
  "SUPPLIER",
] as const;
/** Platform roles: they belong to no party. */
export const PLATFORM_ROLES = ["SYSTEM_ADMIN", "AUDITOR"] as const;
export const USER_ROLES = [...PARTY_ROLES, ...PLATFORM_ROLES] as const;
export type UserRole = (typeof USER_ROLES)[number];

const list = (values: readonly string[]): string => values.map((v) => `'${v}'`).join(", ");

/**
 * Table users: accounts that log in. A user acts for one party, and the party decides which contracts
 * the user sees and which events it may record. SYSTEM_ADMIN and AUDITOR work on the platform and have
 * no party.
 */
@Entity({
  name: "users",
  comment: "Tài khoản đăng nhập. Mỗi người làm việc cho một bên (parties); quản trị hệ thống và kiểm toán không thuộc bên nào.",
})
@Index("users_email_key", ["email"], { unique: true })
@Check("users_email_check", `"email" = lower(trim("email")) AND "email" ~ '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$'`)
@Check("users_full_name_check", `length(trim("full_name")) > 0`)
@Check("users_role_check", `"role" IN (${list(USER_ROLES)})`)
// Party roles need a party; platform roles must not have one.
@Check("users_party_check", `("role" IN (${list(PLATFORM_ROLES)})) = ("party_id" IS NULL)`)
export class User extends BaseModel {
  @PrimaryGeneratedColumn("uuid", { comment: "Mã người dùng (tự sinh)." })
  id!: string;

  @Column({ type: "text", comment: "Email đăng nhập, chữ thường, không trùng." })
  email!: string;

  @Column({ name: "password_hash", type: "text", select: false, comment: "Mật khẩu đã băm (bcrypt); không bao giờ lưu mật khẩu gốc." })
  passwordHash!: string;

  @Column({ name: "full_name", type: "text", comment: "Họ tên hiển thị." })
  fullName!: string;

  @Column({ type: "text", comment: `Vai trò: ${USER_ROLES.join(", ")}.` })
  role!: UserRole;

  @Column({ name: "party_id", type: "text", nullable: true, comment: "Bên mà người dùng làm việc cho; NULL với SYSTEM_ADMIN và AUDITOR." })
  partyId!: string | null;

  @Column({ type: "boolean", default: true, comment: "FALSE: tài khoản bị khóa, không đăng nhập được." })
  active!: boolean;

  @Column({ name: "last_login_at", type: "timestamptz", nullable: true, comment: "Lần đăng nhập gần nhất." })
  lastLoginAt!: Date | null;

  @ManyToOne(() => Party, { onDelete: "RESTRICT", onUpdate: "CASCADE" })
  @JoinColumn({ name: "party_id", referencedColumnName: "partyId", foreignKeyConstraintName: "users_party_fkey" })
  party!: Party | null;
}
