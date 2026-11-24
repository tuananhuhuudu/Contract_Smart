import { MigrationInterface, QueryRunner } from "typeorm";

export class MilestoneEvaluations1795511323960 implements MigrationInterface {
    name = 'MilestoneEvaluations1795511323960'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "milestone_evaluations" ("id" SERIAL NOT NULL, "milestone_id" integer NOT NULL, "trigger_event_id" integer, "rule_id" integer, "decision" text NOT NULL, "reason_code" text NOT NULL, "milestone_status" text NOT NULL, "payable_vnd_mn" numeric(18,2) NOT NULL, "penalty_vnd_mn" numeric(18,2) NOT NULL, "facts" jsonb NOT NULL, "evaluated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "milestone_evaluations_amounts_check" CHECK ("payable_vnd_mn" >= 0 AND "penalty_vnd_mn" >= 0), CONSTRAINT "milestone_evaluations_status_check" CHECK ("milestone_status" IN ('PLANNED', 'IN_PROGRESS', 'WAITING_EVIDENCE', 'WAITING_APPROVAL', 'ON_HOLD', 'REJECTED', 'ELIGIBLE_FOR_PAYMENT', 'PAID_WITH_PENALTY')), CONSTRAINT "milestone_evaluations_reason_check" CHECK ("reason_code" IN ('OPEN_DISPUTE', 'REJECTION_PRESENT', 'UNAUTHORIZED_EVENT', 'MISSING_REQUIRED_EVENT', 'APPROVAL_QUORUM_NOT_MET', 'LATE_COMPLETION', 'ALL_CONDITIONS_MET', 'UNRESOLVED_CONDITION')), CONSTRAINT "milestone_evaluations_decision_check" CHECK ("decision" IN ('RELEASE', 'HOLD', 'REJECT', 'PENALTY')), CONSTRAINT "PK_1571017fc370ca2ef0dfbe3f7fe" PRIMARY KEY ("id")); COMMENT ON COLUMN "milestone_evaluations"."id" IS 'Mã lần chấm (tự sinh).'; COMMENT ON COLUMN "milestone_evaluations"."milestone_id" IS 'Mốc được chấm (milestones.id).'; COMMENT ON COLUMN "milestone_evaluations"."trigger_event_id" IS 'Sự kiện làm engine chấm lại (events.id); NULL khi chấm lúc kích hoạt hoặc bấm Chấm lại.'; COMMENT ON COLUMN "milestone_evaluations"."rule_id" IS 'Luật quyết định (payment_rules.id); NULL khi không luật nào khớp.'; COMMENT ON COLUMN "milestone_evaluations"."decision" IS 'Quyết định: RELEASE (trả), HOLD (giữ), REJECT (từ chối), PENALTY (trả có trừ phạt).'; COMMENT ON COLUMN "milestone_evaluations"."reason_code" IS 'Lý do (mã lý do của luật quyết định).'; COMMENT ON COLUMN "milestone_evaluations"."milestone_status" IS 'Trạng thái mốc sau khi chấm, ví dụ WAITING_EVIDENCE, ON_HOLD, ELIGIBLE_FOR_PAYMENT.'; COMMENT ON COLUMN "milestone_evaluations"."payable_vnd_mn" IS 'Tiền được trả (triệu VND).'; COMMENT ON COLUMN "milestone_evaluations"."penalty_vnd_mn" IS 'Tiền phạt (triệu VND).'; COMMENT ON COLUMN "milestone_evaluations"."facts" IS 'Vì sao: các con số engine tính, kết quả từng luật, chứng từ thiếu / sai thẩm quyền, cảnh báo.'; COMMENT ON COLUMN "milestone_evaluations"."evaluated_at" IS 'Lúc chấm.'`);
        await queryRunner.query(`CREATE INDEX "milestone_evaluations_latest_idx" ON "milestone_evaluations" ("milestone_id", "evaluated_at") `);
        await queryRunner.query(`COMMENT ON TABLE "milestone_evaluations" IS 'Kết quả engine chấm một mốc. Mỗi lần chấm thêm một dòng, chỉ thêm (trigger); dòng mới nhất là trạng thái hiện tại.'`);
        await queryRunner.query(`ALTER TABLE "milestone_evaluations" ADD CONSTRAINT "milestone_evaluations_milestone_fkey" FOREIGN KEY ("milestone_id") REFERENCES "milestones"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "milestone_evaluations" ADD CONSTRAINT "milestone_evaluations_event_fkey" FOREIGN KEY ("trigger_event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "milestone_evaluations" ADD CONSTRAINT "milestone_evaluations_rule_fkey" FOREIGN KEY ("rule_id") REFERENCES "payment_rules"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        // ---------- Hand-written: a decision, once recorded, is never edited or deleted ----------
        await queryRunner.query(`CREATE FUNCTION forbid_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'APPEND_ONLY_TABLE: % rows cannot be changed or deleted', TG_TABLE_NAME USING ERRCODE = 'check_violation';
END $$`);
        await queryRunner.query(`CREATE TRIGGER milestone_evaluations_append_only BEFORE UPDATE OR DELETE ON "milestone_evaluations" FOR EACH ROW EXECUTE FUNCTION forbid_change()`);
        await queryRunner.query(`CREATE TRIGGER milestone_evaluations_no_truncate BEFORE TRUNCATE ON "milestone_evaluations" FOR EACH STATEMENT EXECUTE FUNCTION forbid_truncate()`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TRIGGER milestone_evaluations_no_truncate ON "milestone_evaluations"`);
        await queryRunner.query(`DROP TRIGGER milestone_evaluations_append_only ON "milestone_evaluations"`);
        await queryRunner.query(`DROP FUNCTION forbid_change()`);
        await queryRunner.query(`ALTER TABLE "milestone_evaluations" DROP CONSTRAINT "milestone_evaluations_rule_fkey"`);
        await queryRunner.query(`ALTER TABLE "milestone_evaluations" DROP CONSTRAINT "milestone_evaluations_event_fkey"`);
        await queryRunner.query(`ALTER TABLE "milestone_evaluations" DROP CONSTRAINT "milestone_evaluations_milestone_fkey"`);
        await queryRunner.query(`COMMENT ON TABLE "milestone_evaluations" IS NULL`);
        await queryRunner.query(`DROP INDEX "public"."milestone_evaluations_latest_idx"`);
        await queryRunner.query(`DROP TABLE "milestone_evaluations"`);
    }

}
