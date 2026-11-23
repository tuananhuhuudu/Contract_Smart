import { MigrationInterface, QueryRunner } from "typeorm";

export class Catalogs1795454255247 implements MigrationInterface {
    name = 'Catalogs1795454255247'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "parties" ("version" integer NOT NULL DEFAULT '1', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "id" SERIAL NOT NULL, "name" text NOT NULL, "type" text NOT NULL, "parent_id" integer, "approval_role" text, "approval_limit_vnd_mn" numeric(18,2), "allowed_event_type_ids" integer array NOT NULL DEFAULT '{}', "active" boolean NOT NULL DEFAULT true, CONSTRAINT "parties_limit_check" CHECK ("approval_limit_vnd_mn" IS NULL OR ("type" = 'APPROVER' AND "approval_limit_vnd_mn" >= 0)), CONSTRAINT "parties_approval_role_check" CHECK (("type" = 'APPROVER') = ("approval_role" IS NOT NULL) AND ("approval_role" IS NULL OR "approval_role" IN ('CONTRACT_OWNER', 'FINANCE_APPROVER', 'SECONDARY_APPROVER'))), CONSTRAINT "parties_parent_check" CHECK (("type" = 'APPROVER') = ("parent_id" IS NOT NULL)), CONSTRAINT "parties_type_check" CHECK ("type" IN ('BUYER', 'SUPPLIER', 'APPROVER')), CONSTRAINT "parties_name_check" CHECK (length(trim("name")) > 0), CONSTRAINT "PK_da698299dca60d55f0050dde935" PRIMARY KEY ("id")); COMMENT ON COLUMN "parties"."version" IS 'Số phiên bản, tăng mỗi lần sửa (khóa lạc quan).'; COMMENT ON COLUMN "parties"."created_at" IS 'Thời điểm tạo dòng.'; COMMENT ON COLUMN "parties"."updated_at" IS 'Thời điểm sửa gần nhất.'; COMMENT ON COLUMN "parties"."id" IS 'Mã bên (tự sinh).'; COMMENT ON COLUMN "parties"."name" IS 'Tên của bên, ví dụ Nova An Business JSC.'; COMMENT ON COLUMN "parties"."type" IS 'BUYER (bên mua), SUPPLIER (nhà cung cấp) hoặc APPROVER (người phê duyệt).'; COMMENT ON COLUMN "parties"."parent_id" IS 'Bên mua mà người phê duyệt thuộc về; NULL với bên mua và nhà cung cấp.'; COMMENT ON COLUMN "parties"."approval_role" IS 'Vai trò duyệt: CONTRACT_OWNER, FINANCE_APPROVER, SECONDARY_APPROVER; chỉ với người phê duyệt.'; COMMENT ON COLUMN "parties"."approval_limit_vnd_mn" IS 'Hạn mức được duyệt (triệu VND); chỉ với người phê duyệt.'; COMMENT ON COLUMN "parties"."allowed_event_type_ids" IS 'Các loại sự kiện (event_types.id) bên này được ghi.'; COMMENT ON COLUMN "parties"."active" IS 'FALSE: không chọn được cho hợp đồng mới.'`);
        await queryRunner.query(`CREATE UNIQUE INDEX "parties_name_key" ON "parties" ("name") `);
        await queryRunner.query(`COMMENT ON TABLE "parties" IS 'Các bên: bên mua, nhà cung cấp, người phê duyệt của bên mua.'`);
        await queryRunner.query(`CREATE TABLE "users" ("version" integer NOT NULL DEFAULT '1', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "id" uuid NOT NULL DEFAULT gen_random_uuid(), "email" text NOT NULL, "password_hash" text NOT NULL, "full_name" text NOT NULL, "role" text NOT NULL, "party_id" integer, "active" boolean NOT NULL DEFAULT true, CONSTRAINT "users_party_check" CHECK (("role" IN ('SYSTEM_ADMIN', 'AUDITOR')) = ("party_id" IS NULL)), CONSTRAINT "users_role_check" CHECK ("role" IN ('CONTRACT_OWNER', 'LEGAL_REVIEWER', 'FINANCE_APPROVER', 'SECONDARY_APPROVER', 'ADMIN_AUDITOR', 'SUPPLIER', 'SYSTEM_ADMIN', 'AUDITOR')), CONSTRAINT "users_full_name_check" CHECK (length(trim("full_name")) > 0), CONSTRAINT "users_email_check" CHECK ("email" = lower(trim("email")) AND "email" ~ '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$'), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id")); COMMENT ON COLUMN "users"."version" IS 'Số phiên bản, tăng mỗi lần sửa (khóa lạc quan).'; COMMENT ON COLUMN "users"."created_at" IS 'Thời điểm tạo dòng.'; COMMENT ON COLUMN "users"."updated_at" IS 'Thời điểm sửa gần nhất.'; COMMENT ON COLUMN "users"."id" IS 'Mã người dùng (tự sinh).'; COMMENT ON COLUMN "users"."email" IS 'Email đăng nhập, chữ thường, không trùng.'; COMMENT ON COLUMN "users"."password_hash" IS 'Mật khẩu đã băm (bcrypt); không bao giờ lưu mật khẩu gốc.'; COMMENT ON COLUMN "users"."full_name" IS 'Họ tên hiển thị.'; COMMENT ON COLUMN "users"."role" IS 'Vai trò: CONTRACT_OWNER, LEGAL_REVIEWER, FINANCE_APPROVER, SECONDARY_APPROVER, ADMIN_AUDITOR, SUPPLIER, SYSTEM_ADMIN, AUDITOR.'; COMMENT ON COLUMN "users"."party_id" IS 'Bên (parties.id) mà người dùng làm việc cho; NULL với SYSTEM_ADMIN và AUDITOR.'; COMMENT ON COLUMN "users"."active" IS 'FALSE: tài khoản bị khóa, không đăng nhập được.'`);
        await queryRunner.query(`CREATE UNIQUE INDEX "users_email_key" ON "users" ("email") `);
        await queryRunner.query(`COMMENT ON TABLE "users" IS 'Tài khoản đăng nhập. Mỗi người làm việc cho một bên (parties); quản trị hệ thống và kiểm toán không thuộc bên nào.'`);
        await queryRunner.query(`CREATE TABLE "event_types" ("version" integer NOT NULL DEFAULT '1', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "id" SERIAL NOT NULL, "name" text NOT NULL, "category" text NOT NULL, "actor_side" text, "valid_status" text NOT NULL, "active" boolean NOT NULL DEFAULT true, CONSTRAINT "event_types_valid_status_check" CHECK ("valid_status" IN ('CONFIRMED', 'APPROVED', 'REJECTED', 'OPEN', 'RESOLVED')), CONSTRAINT "event_types_evidence_side_check" CHECK (("category" = 'EVIDENCE') = ("actor_side" IS NOT NULL)), CONSTRAINT "event_types_side_check" CHECK ("actor_side" IN ('BUYER', 'SUPPLIER')), CONSTRAINT "event_types_category_check" CHECK ("category" IN ('EVIDENCE', 'APPROVAL', 'REJECTION', 'DISPUTE_OPEN', 'DISPUTE_RESOLVE', 'OTHER')), CONSTRAINT "event_types_name_check" CHECK (length(trim("name")) > 0), CONSTRAINT "PK_ffe6b2d60596409fb08fb13830d" PRIMARY KEY ("id")); COMMENT ON COLUMN "event_types"."version" IS 'Số phiên bản, tăng mỗi lần sửa (khóa lạc quan).'; COMMENT ON COLUMN "event_types"."created_at" IS 'Thời điểm tạo dòng.'; COMMENT ON COLUMN "event_types"."updated_at" IS 'Thời điểm sửa gần nhất.'; COMMENT ON COLUMN "event_types"."id" IS 'Mã loại sự kiện (tự sinh).'; COMMENT ON COLUMN "event_types"."name" IS 'Tên hiển thị trên nút, ví dụ Giao hàng.'; COMMENT ON COLUMN "event_types"."category" IS 'Nhóm: EVIDENCE (chứng từ), APPROVAL, REJECTION, DISPUTE_OPEN, DISPUTE_RESOLVE, OTHER.'; COMMENT ON COLUMN "event_types"."actor_side" IS 'Với chứng từ: bên được ghi (BUYER hoặc SUPPLIER); NULL với các nhóm khác.'; COMMENT ON COLUMN "event_types"."valid_status" IS 'Trạng thái API tự điền cho mọi sự kiện loại này: CONFIRMED, APPROVED, REJECTED, OPEN, RESOLVED.'; COMMENT ON COLUMN "event_types"."active" IS 'FALSE: ẩn khỏi danh sách chọn; sự kiện cũ vẫn giữ.'`);
        await queryRunner.query(`CREATE UNIQUE INDEX "event_types_name_key" ON "event_types" ("name") `);
        await queryRunner.query(`COMMENT ON TABLE "event_types" IS 'Danh mục loại sự kiện. Engine chỉ đọc nhóm (category), không đọc tên.'`);
        // ---------- Hand-written: the 16 event types of the organiser's data, so the catalogue is never empty ----------
        // Category and recording side follow docs/NGHIEP_VU.md section 2.1; the status follows from the category.
        await queryRunner.query(`INSERT INTO "event_types" (name, category, actor_side, valid_status) VALUES
('Ký hợp đồng', 'EVIDENCE', 'BUYER', 'CONFIRMED'),
('Xác nhận khởi động', 'EVIDENCE', 'BUYER', 'CONFIRMED'),
('Duyệt yêu cầu', 'EVIDENCE', 'BUYER', 'CONFIRMED'),
('Đạt kiểm thử người dùng (UAT)', 'EVIDENCE', 'BUYER', 'CONFIRMED'),
('Nghiệm thu', 'EVIDENCE', 'BUYER', 'CONFIRMED'),
('Giao hàng', 'EVIDENCE', 'SUPPLIER', 'CONFIRMED'),
('Hóa đơn', 'EVIDENCE', 'SUPPLIER', 'CONFIRMED'),
('Đưa vào vận hành', 'EVIDENCE', 'SUPPLIER', 'CONFIRMED'),
('Kích hoạt dịch vụ', 'EVIDENCE', 'SUPPLIER', 'CONFIRMED'),
('Hoàn thành dịch vụ', 'EVIDENCE', 'SUPPLIER', 'CONFIRMED'),
('Hết bảo hành', 'EVIDENCE', 'SUPPLIER', 'CONFIRMED'),
('Phê duyệt', 'APPROVAL', NULL, 'APPROVED'),
('Từ chối', 'REJECTION', NULL, 'REJECTED'),
('Mở tranh chấp', 'DISPUTE_OPEN', NULL, 'OPEN'),
('Đóng tranh chấp', 'DISPUTE_RESOLVE', NULL, 'RESOLVED'),
('Đề nghị đóng hợp đồng', 'OTHER', NULL, 'CONFIRMED')`);
        await queryRunner.query(`ALTER TABLE "parties" ADD CONSTRAINT "parties_parent_fkey" FOREIGN KEY ("parent_id") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "users_party_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "users_party_fkey"`);
        await queryRunner.query(`ALTER TABLE "parties" DROP CONSTRAINT "parties_parent_fkey"`);
        await queryRunner.query(`COMMENT ON TABLE "event_types" IS NULL`);
        await queryRunner.query(`DROP INDEX "public"."event_types_name_key"`);
        await queryRunner.query(`DROP TABLE "event_types"`);
        await queryRunner.query(`COMMENT ON TABLE "users" IS NULL`);
        await queryRunner.query(`DROP INDEX "public"."users_email_key"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`COMMENT ON TABLE "parties" IS NULL`);
        await queryRunner.query(`DROP INDEX "public"."parties_name_key"`);
        await queryRunner.query(`DROP TABLE "parties"`);
    }

}
