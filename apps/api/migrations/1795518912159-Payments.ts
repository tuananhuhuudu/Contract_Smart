import { MigrationInterface, QueryRunner } from "typeorm";

export class Payments1795518912159 implements MigrationInterface {
    name = 'Payments1795518912159'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "payments" ("version" integer NOT NULL DEFAULT '1', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "id" SERIAL NOT NULL, "milestone_id" integer NOT NULL, "evaluation_id" integer NOT NULL, "amount_vnd_mn" numeric(18,2) NOT NULL, "penalty_vnd_mn" numeric(18,2) NOT NULL, "status" text NOT NULL DEFAULT 'PENDING', "approved_by" uuid, "paid_at" TIMESTAMP WITH TIME ZONE, "gateway_ref" text, "note" text NOT NULL DEFAULT '', CONSTRAINT "payments_paid_check" CHECK (("status" = 'PAID') = ("paid_at" IS NOT NULL AND "approved_by" IS NOT NULL AND "gateway_ref" IS NOT NULL)), CONSTRAINT "payments_amounts_check" CHECK ("amount_vnd_mn" > 0 AND "penalty_vnd_mn" >= 0), CONSTRAINT "payments_status_check" CHECK ("status" IN ('PENDING', 'PAID', 'CANCELLED')), CONSTRAINT "PK_197ab7af18c93fbb0c9b28b4a59" PRIMARY KEY ("id")); COMMENT ON COLUMN "payments"."version" IS 'Số phiên bản, tăng mỗi lần sửa (khóa lạc quan).'; COMMENT ON COLUMN "payments"."created_at" IS 'Thời điểm tạo dòng.'; COMMENT ON COLUMN "payments"."updated_at" IS 'Thời điểm sửa gần nhất.'; COMMENT ON COLUMN "payments"."id" IS 'Mã lệnh chi (tự sinh).'; COMMENT ON COLUMN "payments"."milestone_id" IS 'Mốc được chi (milestones.id).'; COMMENT ON COLUMN "payments"."evaluation_id" IS 'Lần chấm của engine làm căn cứ chi (milestone_evaluations.id).'; COMMENT ON COLUMN "payments"."amount_vnd_mn" IS 'Số tiền chi cho nhà cung cấp (triệu VND), đã trừ phạt.'; COMMENT ON COLUMN "payments"."penalty_vnd_mn" IS 'Tiền phạt đã trừ (triệu VND).'; COMMENT ON COLUMN "payments"."status" IS 'PENDING (chờ duyệt chi), PAID (đã chi), CANCELLED (đã hủy vì engine chấm lại).'; COMMENT ON COLUMN "payments"."approved_by" IS 'Người duyệt tài chính đã duyệt (users.id).'; COMMENT ON COLUMN "payments"."paid_at" IS 'Lúc duyệt và gửi cổng thanh toán.'; COMMENT ON COLUMN "payments"."gateway_ref" IS 'Mã giao dịch cổng thanh toán trả về (bản demo: SIM-...).'; COMMENT ON COLUMN "payments"."note" IS 'Ghi chú, ví dụ lý do hủy.'`);
        await queryRunner.query(`CREATE INDEX "payments_milestone_idx" ON "payments" ("milestone_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "payments_one_open_per_milestone" ON "payments" ("milestone_id") WHERE "status" <> 'CANCELLED'`);
        await queryRunner.query(`COMMENT ON TABLE "payments" IS 'Lệnh chi của một mốc: hệ thống lập khi engine cho trả, duyệt tài chính bên mua duyệt thì chi. Không xóa; đã chi thì không sửa.'`);
        await queryRunner.query(`ALTER TABLE "payments" ADD CONSTRAINT "payments_milestone_fkey" FOREIGN KEY ("milestone_id") REFERENCES "milestones"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "payments" ADD CONSTRAINT "payments_evaluation_fkey" FOREIGN KEY ("evaluation_id") REFERENCES "milestone_evaluations"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "payments" ADD CONSTRAINT "payments_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);

        // ---------- Hand-written: an order is never deleted, goes PENDING -> PAID or CANCELLED, and then never changes ----------
        await queryRunner.query(`CREATE FUNCTION guard_payment() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'PAYMENT_LOCKED: payment % cannot be deleted', OLD.id USING ERRCODE = 'check_violation';
  END IF;
  IF OLD.status <> 'PENDING' THEN
    RAISE EXCEPTION 'PAYMENT_LOCKED: payment % is %, it cannot change', OLD.id, OLD.status USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.status NOT IN ('PENDING', 'PAID', 'CANCELLED') THEN
    RAISE EXCEPTION 'PAYMENT_STATUS: PENDING -> % is not allowed', NEW.status USING ERRCODE = 'check_violation';
  END IF;
  IF (NEW.milestone_id, NEW.evaluation_id, NEW.amount_vnd_mn, NEW.penalty_vnd_mn)
      IS DISTINCT FROM (OLD.milestone_id, OLD.evaluation_id, OLD.amount_vnd_mn, OLD.penalty_vnd_mn) THEN
    RAISE EXCEPTION 'PAYMENT_LOCKED: the milestone, evaluation and amounts of payment % cannot change', OLD.id USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$`);
        await queryRunner.query(`CREATE TRIGGER payments_guard BEFORE UPDATE OR DELETE ON "payments" FOR EACH ROW EXECUTE FUNCTION guard_payment()`);
        await queryRunner.query(`CREATE TRIGGER payments_no_truncate BEFORE TRUNCATE ON "payments" FOR EACH STATEMENT EXECUTE FUNCTION forbid_truncate()`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TRIGGER payments_no_truncate ON "payments"`);
        await queryRunner.query(`DROP TRIGGER payments_guard ON "payments"`);
        await queryRunner.query(`DROP FUNCTION guard_payment()`);
        await queryRunner.query(`ALTER TABLE "payments" DROP CONSTRAINT "payments_approved_by_fkey"`);
        await queryRunner.query(`ALTER TABLE "payments" DROP CONSTRAINT "payments_evaluation_fkey"`);
        await queryRunner.query(`ALTER TABLE "payments" DROP CONSTRAINT "payments_milestone_fkey"`);
        await queryRunner.query(`COMMENT ON TABLE "payments" IS NULL`);
        await queryRunner.query(`DROP INDEX "public"."payments_one_open_per_milestone"`);
        await queryRunner.query(`DROP INDEX "public"."payments_milestone_idx"`);
        await queryRunner.query(`DROP TABLE "payments"`);
    }

}
