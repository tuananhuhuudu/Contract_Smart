import { MigrationInterface, QueryRunner } from "typeorm";

export class Users1795432650353 implements MigrationInterface {
    name = 'Users1795432650353'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "users" ("version" integer NOT NULL DEFAULT '1', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "id" uuid NOT NULL DEFAULT gen_random_uuid(), "email" text NOT NULL, "password_hash" text NOT NULL, "full_name" text NOT NULL, "role" text NOT NULL, "party_id" text, "active" boolean NOT NULL DEFAULT true, "last_login_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "users_party_check" CHECK (("role" IN ('SYSTEM_ADMIN', 'AUDITOR')) = ("party_id" IS NULL)), CONSTRAINT "users_role_check" CHECK ("role" IN ('CONTRACT_OWNER', 'LEGAL_REVIEWER', 'FINANCE_APPROVER', 'SECONDARY_APPROVER', 'ADMIN_AUDITOR', 'SUPPLIER', 'SYSTEM_ADMIN', 'AUDITOR')), CONSTRAINT "users_full_name_check" CHECK (length(trim("full_name")) > 0), CONSTRAINT "users_email_check" CHECK ("email" = lower(trim("email")) AND "email" ~ '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$'), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id")); COMMENT ON COLUMN "users"."version" IS 'Số phiên bản, tăng mỗi lần sửa (khóa lạc quan).'; COMMENT ON COLUMN "users"."created_at" IS 'Thời điểm tạo dòng.'; COMMENT ON COLUMN "users"."updated_at" IS 'Thời điểm sửa gần nhất.'; COMMENT ON COLUMN "users"."id" IS 'Mã người dùng (tự sinh).'; COMMENT ON COLUMN "users"."email" IS 'Email đăng nhập, chữ thường, không trùng.'; COMMENT ON COLUMN "users"."password_hash" IS 'Mật khẩu đã băm (bcrypt); không bao giờ lưu mật khẩu gốc.'; COMMENT ON COLUMN "users"."full_name" IS 'Họ tên hiển thị.'; COMMENT ON COLUMN "users"."role" IS 'Vai trò: CONTRACT_OWNER, LEGAL_REVIEWER, FINANCE_APPROVER, SECONDARY_APPROVER, ADMIN_AUDITOR, SUPPLIER, SYSTEM_ADMIN, AUDITOR.'; COMMENT ON COLUMN "users"."party_id" IS 'Bên mà người dùng làm việc cho; NULL với SYSTEM_ADMIN và AUDITOR.'; COMMENT ON COLUMN "users"."active" IS 'FALSE: tài khoản bị khóa, không đăng nhập được.'; COMMENT ON COLUMN "users"."last_login_at" IS 'Lần đăng nhập gần nhất.'`);
        await queryRunner.query(`CREATE UNIQUE INDEX "users_email_key" ON "users" ("email") `);
        await queryRunner.query(`COMMENT ON TABLE "users" IS 'Tài khoản đăng nhập. Mỗi người làm việc cho một bên (parties); quản trị hệ thống và kiểm toán không thuộc bên nào.'`);
        await queryRunner.query(`COMMENT ON COLUMN "rule_versions"."created_by" IS 'Người soạn (users.id); NULL với phiên bản của Data Pack.'`);
        await queryRunner.query(`COMMENT ON COLUMN "rule_versions"."published_by" IS 'Người công bố (users.id); phải khác người soạn.'`);
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "users_party_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("party_id") ON DELETE RESTRICT ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "rule_versions" ADD CONSTRAINT "rule_versions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "rule_versions" ADD CONSTRAINT "rule_versions_published_by_fkey" FOREIGN KEY ("published_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "rule_versions" DROP CONSTRAINT "rule_versions_published_by_fkey"`);
        await queryRunner.query(`ALTER TABLE "rule_versions" DROP CONSTRAINT "rule_versions_created_by_fkey"`);
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "users_party_fkey"`);
        await queryRunner.query(`COMMENT ON COLUMN "rule_versions"."published_by" IS 'Người công bố; phải khác người soạn.'`);
        await queryRunner.query(`COMMENT ON COLUMN "rule_versions"."created_by" IS 'Người soạn; NULL với phiên bản của Data Pack.'`);
        await queryRunner.query(`COMMENT ON TABLE "users" IS NULL`);
        await queryRunner.query(`DROP INDEX "public"."users_email_key"`);
        await queryRunner.query(`DROP TABLE "users"`);
    }

}
