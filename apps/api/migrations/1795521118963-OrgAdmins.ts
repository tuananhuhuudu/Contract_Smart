import { MigrationInterface, QueryRunner } from "typeorm";

export class OrgAdmins1795521118963 implements MigrationInterface {
    name = 'OrgAdmins1795521118963'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "created_by" uuid`);
        await queryRunner.query(`COMMENT ON COLUMN "users"."created_by" IS 'Ai tạo tài khoản này (users.id); NULL với tài khoản nạp sẵn.'`);
        await queryRunner.query(`COMMENT ON COLUMN "users"."role" IS 'Vai trò: CONTRACT_OWNER, LEGAL_REVIEWER, FINANCE_APPROVER, SECONDARY_APPROVER, ADMIN_AUDITOR, SUPPLIER, ORG_ADMIN, SYSTEM_ADMIN, AUDITOR.'`);
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "users_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        // ---------- Hand-written: TypeORM does not diff CHECK constraints ----------
        // New role ORG_ADMIN (a company's account administrator); it works for a party like the other company roles.
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "users_role_check"`);
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "users_role_check" CHECK ("role" IN ('CONTRACT_OWNER', 'LEGAL_REVIEWER', 'FINANCE_APPROVER', 'SECONDARY_APPROVER', 'ADMIN_AUDITOR', 'SUPPLIER', 'ORG_ADMIN', 'SYSTEM_ADMIN', 'AUDITOR'))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "users_role_check"`);
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "users_role_check" CHECK ("role" IN ('CONTRACT_OWNER', 'LEGAL_REVIEWER', 'FINANCE_APPROVER', 'SECONDARY_APPROVER', 'ADMIN_AUDITOR', 'SUPPLIER', 'SYSTEM_ADMIN', 'AUDITOR'))`);
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "users_created_by_fkey"`);
        await queryRunner.query(`COMMENT ON COLUMN "users"."role" IS 'Vai trò: CONTRACT_OWNER, LEGAL_REVIEWER, FINANCE_APPROVER, SECONDARY_APPROVER, ADMIN_AUDITOR, SUPPLIER, SYSTEM_ADMIN, AUDITOR.'`);
        await queryRunner.query(`COMMENT ON COLUMN "users"."created_by" IS 'Ai tạo tài khoản này (users.id); NULL với tài khoản nạp sẵn.'`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "created_by"`);
    }

}
