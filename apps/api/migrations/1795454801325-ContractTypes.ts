import { MigrationInterface, QueryRunner } from "typeorm";

export class ContractTypes1795454801325 implements MigrationInterface {
    name = 'ContractTypes1795454801325'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "contract_type_milestones" ("version" integer NOT NULL DEFAULT '1', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "id" SERIAL NOT NULL, "contract_type_id" integer NOT NULL, "position" integer NOT NULL, "milestone_id" integer NOT NULL, "payment_percent" numeric(5,2) NOT NULL, "due_after_days" integer NOT NULL, CONSTRAINT "contract_type_milestones_days_check" CHECK ("due_after_days" >= 0), CONSTRAINT "contract_type_milestones_percent_check" CHECK ("payment_percent" > 0 AND "payment_percent" <= 100), CONSTRAINT "contract_type_milestones_position_check" CHECK ("position" >= 1), CONSTRAINT "PK_f075cfb9819af31d77b653f748a" PRIMARY KEY ("id")); COMMENT ON COLUMN "contract_type_milestones"."version" IS 'Số phiên bản, tăng mỗi lần sửa (khóa lạc quan).'; COMMENT ON COLUMN "contract_type_milestones"."created_at" IS 'Thời điểm tạo dòng.'; COMMENT ON COLUMN "contract_type_milestones"."updated_at" IS 'Thời điểm sửa gần nhất.'; COMMENT ON COLUMN "contract_type_milestones"."id" IS 'Mã dòng khuôn (tự sinh).'; COMMENT ON COLUMN "contract_type_milestones"."contract_type_id" IS 'Loại hợp đồng (contract_types.id).'; COMMENT ON COLUMN "contract_type_milestones"."position" IS 'Thứ tự mốc trong loại hợp đồng: 1, 2, 3 (theo hạn).'; COMMENT ON COLUMN "contract_type_milestones"."milestone_id" IS 'Mốc trong thư viện (milestone_library.id).'; COMMENT ON COLUMN "contract_type_milestones"."payment_percent" IS 'Phần trăm giá trị hợp đồng của mốc, ví dụ 40.00; tổng các mốc = 100 mới tạo được hợp đồng.'; COMMENT ON COLUMN "contract_type_milestones"."due_after_days" IS 'Hạn = ngày bắt đầu hợp đồng + số ngày.'`);
        await queryRunner.query(`CREATE UNIQUE INDEX "contract_type_milestones_milestone_key" ON "contract_type_milestones" ("contract_type_id", "milestone_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "contract_type_milestones_position_key" ON "contract_type_milestones" ("contract_type_id", "position") `);
        await queryRunner.query(`COMMENT ON TABLE "contract_type_milestones" IS 'Khuôn của loại hợp đồng: gồm mốc nào trong thư viện, bao nhiêu %, hạn bao lâu.'`);
        await queryRunner.query(`CREATE TABLE "contract_types" ("version" integer NOT NULL DEFAULT '1', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "id" SERIAL NOT NULL, "name" text NOT NULL, "active" boolean NOT NULL DEFAULT true, CONSTRAINT "contract_types_name_check" CHECK (length(trim("name")) > 0), CONSTRAINT "PK_5b568d39e833de527bca6d2a64d" PRIMARY KEY ("id")); COMMENT ON COLUMN "contract_types"."version" IS 'Số phiên bản, tăng mỗi lần sửa (khóa lạc quan).'; COMMENT ON COLUMN "contract_types"."created_at" IS 'Thời điểm tạo dòng.'; COMMENT ON COLUMN "contract_types"."updated_at" IS 'Thời điểm sửa gần nhất.'; COMMENT ON COLUMN "contract_types"."id" IS 'Mã loại hợp đồng (tự sinh).'; COMMENT ON COLUMN "contract_types"."name" IS 'Tên loại, ví dụ Tư vấn.'; COMMENT ON COLUMN "contract_types"."active" IS 'FALSE: không tạo được hợp đồng mới loại này.'`);
        await queryRunner.query(`CREATE UNIQUE INDEX "contract_types_name_key" ON "contract_types" ("name") `);
        await queryRunner.query(`COMMENT ON TABLE "contract_types" IS 'Loại hợp đồng. Khuôn mốc nằm ở contract_type_milestones.'`);
        await queryRunner.query(`ALTER TABLE "contract_type_milestones" ADD CONSTRAINT "contract_type_milestones_type_fkey" FOREIGN KEY ("contract_type_id") REFERENCES "contract_types"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "contract_type_milestones" ADD CONSTRAINT "contract_type_milestones_milestone_fkey" FOREIGN KEY ("milestone_id") REFERENCES "milestone_library"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "contract_type_milestones" DROP CONSTRAINT "contract_type_milestones_milestone_fkey"`);
        await queryRunner.query(`ALTER TABLE "contract_type_milestones" DROP CONSTRAINT "contract_type_milestones_type_fkey"`);
        await queryRunner.query(`COMMENT ON TABLE "contract_types" IS NULL`);
        await queryRunner.query(`DROP INDEX "public"."contract_types_name_key"`);
        await queryRunner.query(`DROP TABLE "contract_types"`);
        await queryRunner.query(`COMMENT ON TABLE "contract_type_milestones" IS NULL`);
        await queryRunner.query(`DROP INDEX "public"."contract_type_milestones_position_key"`);
        await queryRunner.query(`DROP INDEX "public"."contract_type_milestones_milestone_key"`);
        await queryRunner.query(`DROP TABLE "contract_type_milestones"`);
    }

}
