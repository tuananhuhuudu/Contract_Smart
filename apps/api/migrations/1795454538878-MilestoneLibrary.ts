import { MigrationInterface, QueryRunner } from "typeorm";

export class MilestoneLibrary1795454538878 implements MigrationInterface {
    name = 'MilestoneLibrary1795454538878'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "milestone_library" ("version" integer NOT NULL DEFAULT '1', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "id" SERIAL NOT NULL, "name" text NOT NULL, "active" boolean NOT NULL DEFAULT true, CONSTRAINT "milestone_library_name_check" CHECK (length(trim("name")) > 0), CONSTRAINT "PK_7af5ce638c5e76e50b07a150acf" PRIMARY KEY ("id")); COMMENT ON COLUMN "milestone_library"."version" IS 'Số phiên bản, tăng mỗi lần sửa (khóa lạc quan).'; COMMENT ON COLUMN "milestone_library"."created_at" IS 'Thời điểm tạo dòng.'; COMMENT ON COLUMN "milestone_library"."updated_at" IS 'Thời điểm sửa gần nhất.'; COMMENT ON COLUMN "milestone_library"."id" IS 'Mã mốc (tự sinh).'; COMMENT ON COLUMN "milestone_library"."name" IS 'Tên mốc, ví dụ Nộp báo cáo.'; COMMENT ON COLUMN "milestone_library"."active" IS 'FALSE: không chọn được cho loại hợp đồng mới; dữ liệu cũ vẫn giữ.'`);
        await queryRunner.query(`CREATE UNIQUE INDEX "milestone_library_name_key" ON "milestone_library" ("name") `);
        await queryRunner.query(`COMMENT ON TABLE "milestone_library" IS 'Thư viện mốc thanh toán, dùng chung cho mọi loại hợp đồng. Điều kiện và luật nằm ở các phiên bản.'`);
        await queryRunner.query(`CREATE TABLE "milestone_versions" ("version" integer NOT NULL DEFAULT '1', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "id" SERIAL NOT NULL, "milestone_id" integer NOT NULL, "is_custom" boolean NOT NULL DEFAULT false, "version_no" integer NOT NULL, "status" text NOT NULL DEFAULT 'DRAFT', "required_event_type_ids" integer array NOT NULL DEFAULT '{}', "late_penalty" boolean NOT NULL DEFAULT false, "note" text, "published_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "milestone_versions_published_check" CHECK (("status" = 'DRAFT') = ("published_at" IS NULL)), CONSTRAINT "milestone_versions_number_check" CHECK ("version_no" >= 1), CONSTRAINT "milestone_versions_status_check" CHECK ("status" IN ('DRAFT', 'PUBLISHED', 'RETIRED')), CONSTRAINT "PK_bcd4ca1d3aa08f37a6f1c2476a1" PRIMARY KEY ("id")); COMMENT ON COLUMN "milestone_versions"."version" IS 'Số phiên bản, tăng mỗi lần sửa (khóa lạc quan).'; COMMENT ON COLUMN "milestone_versions"."created_at" IS 'Thời điểm tạo dòng.'; COMMENT ON COLUMN "milestone_versions"."updated_at" IS 'Thời điểm sửa gần nhất.'; COMMENT ON COLUMN "milestone_versions"."id" IS 'Mã phiên bản (tự sinh).'; COMMENT ON COLUMN "milestone_versions"."milestone_id" IS 'Phiên bản của mốc nào (milestone_library.id).'; COMMENT ON COLUMN "milestone_versions"."is_custom" IS 'FALSE: phiên bản chung trong thư viện; TRUE: luật riêng của một hợp đồng (tìm hợp đồng qua milestones).'; COMMENT ON COLUMN "milestone_versions"."version_no" IS 'Số phiên bản của mốc: 1, 2, 3...'; COMMENT ON COLUMN "milestone_versions"."status" IS 'DRAFT (đang soạn, sửa được) -> PUBLISHED (đang dùng, khóa) -> RETIRED (ngừng dùng cho hợp đồng mới).'; COMMENT ON COLUMN "milestone_versions"."required_event_type_ids" IS 'Sự kiện bắt buộc (event_types.id): phải có đủ mới được trả tiền.'; COMMENT ON COLUMN "milestone_versions"."late_penalty" IS 'Trễ hạn có bị phạt không (luật phạt trễ đọc cờ này).'; COMMENT ON COLUMN "milestone_versions"."note" IS 'Lần sửa này đổi gì.'; COMMENT ON COLUMN "milestone_versions"."published_at" IS 'Thời điểm công bố.'`);
        await queryRunner.query(`CREATE UNIQUE INDEX "milestone_versions_one_published_key" ON "milestone_versions" ("milestone_id") WHERE "status" = 'PUBLISHED' AND NOT "is_custom"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "milestone_versions_number_key" ON "milestone_versions" ("milestone_id", "version_no") WHERE NOT "is_custom"`);
        await queryRunner.query(`COMMENT ON TABLE "milestone_versions" IS 'Phiên bản điều kiện + luật của một mốc. Đã công bố thì khóa; muốn sửa thì tạo phiên bản mới.'`);
        await queryRunner.query(`CREATE TABLE "payment_rules" ("version" integer NOT NULL DEFAULT '1', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "id" SERIAL NOT NULL, "milestone_version_id" integer NOT NULL, "priority" integer NOT NULL, "name" text NOT NULL, "condition" text NOT NULL, "decision" text NOT NULL, "reason_code" text NOT NULL, "payable_formula" text NOT NULL DEFAULT '0', "penalty_formula" text NOT NULL DEFAULT '0', CONSTRAINT "payment_rules_reason_check" CHECK ("reason_code" IN ('OPEN_DISPUTE', 'REJECTION_PRESENT', 'UNAUTHORIZED_EVENT', 'MISSING_REQUIRED_EVENT', 'APPROVAL_QUORUM_NOT_MET', 'LATE_COMPLETION', 'ALL_CONDITIONS_MET', 'UNRESOLVED_CONDITION')), CONSTRAINT "payment_rules_decision_check" CHECK ("decision" IN ('RELEASE', 'HOLD', 'REJECT', 'PENALTY')), CONSTRAINT "payment_rules_condition_check" CHECK (length(trim("condition")) > 0), CONSTRAINT "payment_rules_name_check" CHECK (length(trim("name")) > 0), CONSTRAINT "payment_rules_priority_check" CHECK ("priority" >= 1), CONSTRAINT "PK_6f069e4e255177e0fdb2fc49d74" PRIMARY KEY ("id")); COMMENT ON COLUMN "payment_rules"."version" IS 'Số phiên bản, tăng mỗi lần sửa (khóa lạc quan).'; COMMENT ON COLUMN "payment_rules"."created_at" IS 'Thời điểm tạo dòng.'; COMMENT ON COLUMN "payment_rules"."updated_at" IS 'Thời điểm sửa gần nhất.'; COMMENT ON COLUMN "payment_rules"."id" IS 'Mã luật (tự sinh).'; COMMENT ON COLUMN "payment_rules"."milestone_version_id" IS 'Luật của phiên bản mốc nào (milestone_versions.id).'; COMMENT ON COLUMN "payment_rules"."priority" IS 'Thứ tự xét: 10, 20... số nhỏ xét trước.'; COMMENT ON COLUMN "payment_rules"."name" IS 'Tên luật tiếng Việt, ví dụ Đang tranh chấp thì giữ tiền.'; COMMENT ON COLUMN "payment_rules"."condition" IS 'Điều kiện cho engine, ví dụ open_dispute == TRUE; luật cuối là ELSE.'; COMMENT ON COLUMN "payment_rules"."decision" IS 'Quyết định: RELEASE (trả), HOLD (giữ), REJECT (từ chối), PENALTY (trả có trừ phạt).'; COMMENT ON COLUMN "payment_rules"."reason_code" IS 'Lý do, một trong 8 mã engine biết, ví dụ MISSING_REQUIRED_EVENT.'; COMMENT ON COLUMN "payment_rules"."payable_formula" IS 'Công thức tiền được trả, ví dụ planned_payment_vnd_mn.'; COMMENT ON COLUMN "payment_rules"."penalty_formula" IS 'Công thức tiền phạt.'`);
        await queryRunner.query(`CREATE UNIQUE INDEX "payment_rules_priority_key" ON "payment_rules" ("milestone_version_id", "priority") `);
        await queryRunner.query(`COMMENT ON TABLE "payment_rules" IS 'Luật của một phiên bản mốc: nếu ... thì ... vì .... Xét theo ưu tiên, luật đầu tiên khớp quyết định.'`);
        await queryRunner.query(`ALTER TABLE "milestone_versions" ADD CONSTRAINT "milestone_versions_milestone_fkey" FOREIGN KEY ("milestone_id") REFERENCES "milestone_library"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "payment_rules" ADD CONSTRAINT "payment_rules_version_fkey" FOREIGN KEY ("milestone_version_id") REFERENCES "milestone_versions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);

        // ---------- Hand-written: lock a version once it is no longer a draft ----------
        // DRAFT -> PUBLISHED -> RETIRED only; a published or retired version keeps its content,
        // and only a draft can be deleted (a draft custom version is dropped when a contract goes back to shared rules).
        await queryRunner.query(`CREATE FUNCTION guard_milestone_version() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status <> 'DRAFT' THEN
      RAISE EXCEPTION 'MILESTONE_VERSION_LOCKED: version % is %, only a draft can be deleted', OLD.id, OLD.status USING ERRCODE = 'check_violation';
    END IF;
    RETURN OLD;
  END IF;
  IF NOT ((OLD.status = NEW.status) OR (OLD.status = 'DRAFT' AND NEW.status = 'PUBLISHED') OR (OLD.status = 'PUBLISHED' AND NEW.status = 'RETIRED')) THEN
    RAISE EXCEPTION 'MILESTONE_VERSION_STATUS: % -> % is not allowed (DRAFT -> PUBLISHED -> RETIRED)', OLD.status, NEW.status USING ERRCODE = 'check_violation';
  END IF;
  IF OLD.status <> 'DRAFT' AND (NEW.milestone_id, NEW.is_custom, NEW.version_no, NEW.required_event_type_ids, NEW.late_penalty, NEW.note, NEW.published_at)
      IS DISTINCT FROM (OLD.milestone_id, OLD.is_custom, OLD.version_no, OLD.required_event_type_ids, OLD.late_penalty, OLD.note, OLD.published_at) THEN
    RAISE EXCEPTION 'MILESTONE_VERSION_LOCKED: version % is %, create a new version to change it', OLD.id, OLD.status USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$`);
        await queryRunner.query(`CREATE TRIGGER milestone_versions_guard BEFORE UPDATE OR DELETE ON "milestone_versions" FOR EACH ROW EXECUTE FUNCTION guard_milestone_version()`);
        // Rules can be added, changed or removed only while their version is a draft.
        await queryRunner.query(`CREATE FUNCTION guard_payment_rule() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE locked integer;
BEGIN
  SELECT id INTO locked FROM milestone_versions
   WHERE status <> 'DRAFT' AND id IN (CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.milestone_version_id END,
                                      CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE NEW.milestone_version_id END)
   LIMIT 1;
  IF locked IS NOT NULL THEN
    RAISE EXCEPTION 'MILESTONE_VERSION_LOCKED: rules of version % cannot change, create a new version', locked USING ERRCODE = 'check_violation';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$`);
        await queryRunner.query(`CREATE TRIGGER payment_rules_guard BEFORE INSERT OR UPDATE OR DELETE ON "payment_rules" FOR EACH ROW EXECUTE FUNCTION guard_payment_rule()`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TRIGGER payment_rules_guard ON "payment_rules"`);
        await queryRunner.query(`DROP FUNCTION guard_payment_rule()`);
        await queryRunner.query(`DROP TRIGGER milestone_versions_guard ON "milestone_versions"`);
        await queryRunner.query(`DROP FUNCTION guard_milestone_version()`);
        await queryRunner.query(`ALTER TABLE "payment_rules" DROP CONSTRAINT "payment_rules_version_fkey"`);
        await queryRunner.query(`ALTER TABLE "milestone_versions" DROP CONSTRAINT "milestone_versions_milestone_fkey"`);
        await queryRunner.query(`COMMENT ON TABLE "payment_rules" IS NULL`);
        await queryRunner.query(`DROP INDEX "public"."payment_rules_priority_key"`);
        await queryRunner.query(`DROP TABLE "payment_rules"`);
        await queryRunner.query(`COMMENT ON TABLE "milestone_versions" IS NULL`);
        await queryRunner.query(`DROP INDEX "public"."milestone_versions_number_key"`);
        await queryRunner.query(`DROP INDEX "public"."milestone_versions_one_published_key"`);
        await queryRunner.query(`DROP TABLE "milestone_versions"`);
        await queryRunner.query(`COMMENT ON TABLE "milestone_library" IS NULL`);
        await queryRunner.query(`DROP INDEX "public"."milestone_library_name_key"`);
        await queryRunner.query(`DROP TABLE "milestone_library"`);
    }

}
