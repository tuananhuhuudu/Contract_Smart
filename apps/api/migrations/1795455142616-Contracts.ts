import { MigrationInterface, QueryRunner } from "typeorm";

export class Contracts1795455142616 implements MigrationInterface {
    name = 'Contracts1795455142616'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "contracts" ("version" integer NOT NULL DEFAULT '1', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "id" SERIAL NOT NULL, "title" text NOT NULL, "contract_type_id" integer NOT NULL, "buyer_id" integer NOT NULL, "supplier_id" integer NOT NULL, "value_vnd_mn" numeric(18,2) NOT NULL, "start_on" date NOT NULL, "end_on" date NOT NULL, "approval_policy" text NOT NULL, "grace_days" integer NOT NULL, "penalty_pct_per_day" numeric(7,4) NOT NULL, "max_penalty_pct" numeric(7,4) NOT NULL, "status" text NOT NULL DEFAULT 'DRAFT', CONSTRAINT "contracts_status_check" CHECK ("status" IN ('DRAFT', 'ACTIVE', 'CLOSED')), CONSTRAINT "contracts_terms_check" CHECK ("grace_days" >= 0 AND "penalty_pct_per_day" >= 0 AND "max_penalty_pct" >= 0 AND "max_penalty_pct" <= 100), CONSTRAINT "contracts_policy_check" CHECK ("approval_policy" IN ('AUTO_IF_ALL_CONDITIONS', 'SINGLE_BUYER_APPROVAL', 'DUAL_APPROVAL', 'FINANCE_PLUS_OWNER')), CONSTRAINT "contracts_dates_check" CHECK ("start_on" <= "end_on"), CONSTRAINT "contracts_value_check" CHECK ("value_vnd_mn" > 0), CONSTRAINT "contracts_parties_check" CHECK ("buyer_id" <> "supplier_id"), CONSTRAINT "contracts_title_check" CHECK (length(trim("title")) > 0), CONSTRAINT "PK_2c7b8f3a7b1acdd49497d83d0fb" PRIMARY KEY ("id")); COMMENT ON COLUMN "contracts"."version" IS 'Số phiên bản, tăng mỗi lần sửa (khóa lạc quan).'; COMMENT ON COLUMN "contracts"."created_at" IS 'Thời điểm tạo dòng.'; COMMENT ON COLUMN "contracts"."updated_at" IS 'Thời điểm sửa gần nhất.'; COMMENT ON COLUMN "contracts"."id" IS 'Mã hợp đồng (tự sinh).'; COMMENT ON COLUMN "contracts"."title" IS 'Tên hợp đồng.'; COMMENT ON COLUMN "contracts"."contract_type_id" IS 'Loại hợp đồng (contract_types.id) dùng làm khuôn lúc tạo.'; COMMENT ON COLUMN "contracts"."buyer_id" IS 'Bên mua (parties.id, loại BUYER).'; COMMENT ON COLUMN "contracts"."supplier_id" IS 'Nhà cung cấp (parties.id, loại SUPPLIER).'; COMMENT ON COLUMN "contracts"."value_vnd_mn" IS 'Giá trị hợp đồng (triệu VND); 1000.00 = 1 tỷ đồng.'; COMMENT ON COLUMN "contracts"."start_on" IS 'Ngày bắt đầu; hạn của mốc tính từ ngày này.'; COMMENT ON COLUMN "contracts"."end_on" IS 'Ngày kết thúc.'; COMMENT ON COLUMN "contracts"."approval_policy" IS 'Chính sách duyệt: AUTO_IF_ALL_CONDITIONS, SINGLE_BUYER_APPROVAL, DUAL_APPROVAL, FINANCE_PLUS_OWNER.'; COMMENT ON COLUMN "contracts"."grace_days" IS 'Số ngày ân hạn sau hạn mốc trước khi tính trễ.'; COMMENT ON COLUMN "contracts"."penalty_pct_per_day" IS 'Phạt mỗi ngày trễ (% tiền mốc), ví dụ 0.1000.'; COMMENT ON COLUMN "contracts"."max_penalty_pct" IS 'Trần phạt (% tiền mốc), ví dụ 8.0000.'; COMMENT ON COLUMN "contracts"."status" IS 'DRAFT -> ACTIVE -> CLOSED.'`);
        await queryRunner.query(`COMMENT ON TABLE "contracts" IS 'Hợp đồng. DRAFT: đang đàm phán, chỉnh được; ACTIVE: đã ký, khóa, ghi sự kiện; CLOSED: đã đóng.'`);
        await queryRunner.query(`CREATE TABLE "milestones" ("version" integer NOT NULL DEFAULT '1', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "id" SERIAL NOT NULL, "contract_id" integer NOT NULL, "position" integer NOT NULL, "milestone_version_id" integer NOT NULL, "amount_vnd_mn" numeric(18,2) NOT NULL, "due_on" date NOT NULL, CONSTRAINT "milestones_amount_check" CHECK ("amount_vnd_mn" > 0), CONSTRAINT "milestones_position_check" CHECK ("position" >= 1), CONSTRAINT "PK_0bdbfe399c777a6a8520ff902d9" PRIMARY KEY ("id")); COMMENT ON COLUMN "milestones"."version" IS 'Số phiên bản, tăng mỗi lần sửa (khóa lạc quan).'; COMMENT ON COLUMN "milestones"."created_at" IS 'Thời điểm tạo dòng.'; COMMENT ON COLUMN "milestones"."updated_at" IS 'Thời điểm sửa gần nhất.'; COMMENT ON COLUMN "milestones"."id" IS 'Mã mốc (tự sinh).'; COMMENT ON COLUMN "milestones"."contract_id" IS 'Mốc thuộc hợp đồng nào (contracts.id).'; COMMENT ON COLUMN "milestones"."position" IS 'Thứ tự mốc trong hợp đồng: 1, 2, 3 (theo hạn).'; COMMENT ON COLUMN "milestones"."milestone_version_id" IS 'Phiên bản mốc dùng để chấm (milestone_versions.id); tên mốc lấy qua đây.'; COMMENT ON COLUMN "milestones"."amount_vnd_mn" IS 'Tiền của mốc (triệu VND) = % x giá trị hợp đồng.'; COMMENT ON COLUMN "milestones"."due_on" IS 'Hạn của mốc.'`);
        await queryRunner.query(`CREATE UNIQUE INDEX "milestones_position_key" ON "milestones" ("contract_id", "position") `);
        await queryRunner.query(`COMMENT ON TABLE "milestones" IS 'Mốc thật của hợp đồng: tiền, hạn và phiên bản luật dùng để chấm. Chỉ sửa được khi hợp đồng DRAFT.'`);
        await queryRunner.query(`CREATE TABLE "events" ("id" SERIAL NOT NULL, "milestone_id" integer NOT NULL, "event_type_id" integer NOT NULL, "status" text NOT NULL, "party_id" integer NOT NULL, "recorded_by" uuid, "happened_at" TIMESTAMP NOT NULL, "document_no" text, "resolves_event_id" integer, "note" text NOT NULL DEFAULT '', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "events_status_check" CHECK ("status" IN ('CONFIRMED', 'APPROVED', 'REJECTED', 'OPEN', 'RESOLVED')), CONSTRAINT "PK_40731c7151fe4be3116e45ddf73" PRIMARY KEY ("id")); COMMENT ON COLUMN "events"."id" IS 'Mã sự kiện (tự sinh).'; COMMENT ON COLUMN "events"."milestone_id" IS 'Xảy ra ở mốc nào (milestones.id).'; COMMENT ON COLUMN "events"."event_type_id" IS 'Loại sự kiện (event_types.id).'; COMMENT ON COLUMN "events"."status" IS 'Trạng thái, API tự điền theo event_types.valid_status.'; COMMENT ON COLUMN "events"."party_id" IS 'Bên thực hiện (parties.id).'; COMMENT ON COLUMN "events"."recorded_by" IS 'Người bấm nút (users.id); NULL khi chưa có đăng nhập.'; COMMENT ON COLUMN "events"."happened_at" IS 'Lúc xảy ra, giờ Việt Nam không múi giờ, ví dụ 2026-06-05T09:50:00.'; COMMENT ON COLUMN "events"."document_no" IS 'Số giấy tờ (hóa đơn, biên bản); engine dùng để phát hiện nộp trùng.'; COMMENT ON COLUMN "events"."resolves_event_id" IS 'Chỉ với Đóng tranh chấp: đóng sự kiện Mở tranh chấp nào (events.id).'; COMMENT ON COLUMN "events"."note" IS 'Ghi chú.'; COMMENT ON COLUMN "events"."created_at" IS 'Lúc lưu vào DB.'`);
        await queryRunner.query(`CREATE INDEX "events_milestone_idx" ON "events" ("milestone_id", "happened_at") `);
        await queryRunner.query(`COMMENT ON TABLE "events" IS 'Sự kiện đã xảy ra trên một mốc. Chỉ thêm, không sửa, không xóa (trigger).'`);
        await queryRunner.query(`ALTER TABLE "contracts" ADD CONSTRAINT "contracts_type_fkey" FOREIGN KEY ("contract_type_id") REFERENCES "contract_types"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "contracts" ADD CONSTRAINT "contracts_buyer_fkey" FOREIGN KEY ("buyer_id") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "contracts" ADD CONSTRAINT "contracts_supplier_fkey" FOREIGN KEY ("supplier_id") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "milestones" ADD CONSTRAINT "milestones_contract_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "milestones" ADD CONSTRAINT "milestones_version_fkey" FOREIGN KEY ("milestone_version_id") REFERENCES "milestone_versions"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "events" ADD CONSTRAINT "events_milestone_fkey" FOREIGN KEY ("milestone_id") REFERENCES "milestones"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "events" ADD CONSTRAINT "events_type_fkey" FOREIGN KEY ("event_type_id") REFERENCES "event_types"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "events" ADD CONSTRAINT "events_party_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "events" ADD CONSTRAINT "events_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "events" ADD CONSTRAINT "events_resolves_fkey" FOREIGN KEY ("resolves_event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);

        // ---------- Hand-written: what can change, and when ----------
        // A contract goes DRAFT -> ACTIVE -> CLOSED; once it is no longer a draft its terms are locked.
        await queryRunner.query(`CREATE FUNCTION guard_contract() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status <> 'DRAFT' THEN
      RAISE EXCEPTION 'CONTRACT_LOCKED: contract % is %, only a draft can be deleted', OLD.id, OLD.status USING ERRCODE = 'check_violation';
    END IF;
    RETURN OLD;
  END IF;
  IF NOT ((OLD.status = NEW.status) OR (OLD.status = 'DRAFT' AND NEW.status = 'ACTIVE') OR (OLD.status = 'ACTIVE' AND NEW.status = 'CLOSED')) THEN
    RAISE EXCEPTION 'CONTRACT_STATUS: % -> % is not allowed (DRAFT -> ACTIVE -> CLOSED)', OLD.status, NEW.status USING ERRCODE = 'check_violation';
  END IF;
  IF OLD.status <> 'DRAFT' AND (NEW.title, NEW.contract_type_id, NEW.buyer_id, NEW.supplier_id, NEW.value_vnd_mn, NEW.start_on, NEW.end_on,
      NEW.approval_policy, NEW.grace_days, NEW.penalty_pct_per_day, NEW.max_penalty_pct)
      IS DISTINCT FROM (OLD.title, OLD.contract_type_id, OLD.buyer_id, OLD.supplier_id, OLD.value_vnd_mn, OLD.start_on, OLD.end_on,
      OLD.approval_policy, OLD.grace_days, OLD.penalty_pct_per_day, OLD.max_penalty_pct) THEN
    RAISE EXCEPTION 'CONTRACT_LOCKED: contract % is %, its terms cannot change', OLD.id, OLD.status USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$`);
        await queryRunner.query(`CREATE TRIGGER contracts_guard BEFORE UPDATE OR DELETE ON "contracts" FOR EACH ROW EXECUTE FUNCTION guard_contract()`);
        // Milestones are added, changed or removed only while their contract is a draft.
        await queryRunner.query(`CREATE FUNCTION guard_milestone() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE locked integer;
BEGIN
  SELECT id INTO locked FROM contracts
   WHERE status <> 'DRAFT' AND id IN (CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.contract_id END,
                                      CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE NEW.contract_id END)
   LIMIT 1;
  IF locked IS NOT NULL THEN
    RAISE EXCEPTION 'CONTRACT_LOCKED: milestones of contract % cannot change after activation', locked USING ERRCODE = 'check_violation';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$`);
        await queryRunner.query(`CREATE TRIGGER milestones_guard BEFORE INSERT OR UPDATE OR DELETE ON "milestones" FOR EACH ROW EXECUTE FUNCTION guard_milestone()`);
        // Events: only added, and only while the contract is active.
        await queryRunner.query(`CREATE FUNCTION guard_event() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE contract_status text;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'APPEND_ONLY_TABLE: events cannot be changed or deleted; record a new event instead' USING ERRCODE = 'check_violation';
  END IF;
  SELECT c.status INTO contract_status FROM milestones m JOIN contracts c ON c.id = m.contract_id WHERE m.id = NEW.milestone_id;
  IF contract_status IS DISTINCT FROM 'ACTIVE' THEN
    RAISE EXCEPTION 'CONTRACT_NOT_ACTIVE: events can only be recorded on an active contract (it is %)', coalesce(contract_status, 'missing') USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$`);
        await queryRunner.query(`CREATE TRIGGER events_guard BEFORE INSERT OR UPDATE OR DELETE ON "events" FOR EACH ROW EXECUTE FUNCTION guard_event()`);
        await queryRunner.query(`CREATE FUNCTION forbid_truncate() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'APPEND_ONLY_TABLE: % cannot be truncated', TG_TABLE_NAME USING ERRCODE = 'check_violation';
END $$`);
        await queryRunner.query(`CREATE TRIGGER events_no_truncate BEFORE TRUNCATE ON "events" FOR EACH STATEMENT EXECUTE FUNCTION forbid_truncate()`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TRIGGER events_no_truncate ON "events"`);
        await queryRunner.query(`DROP FUNCTION forbid_truncate()`);
        await queryRunner.query(`DROP TRIGGER events_guard ON "events"`);
        await queryRunner.query(`DROP FUNCTION guard_event()`);
        await queryRunner.query(`DROP TRIGGER milestones_guard ON "milestones"`);
        await queryRunner.query(`DROP FUNCTION guard_milestone()`);
        await queryRunner.query(`DROP TRIGGER contracts_guard ON "contracts"`);
        await queryRunner.query(`DROP FUNCTION guard_contract()`);
        await queryRunner.query(`ALTER TABLE "events" DROP CONSTRAINT "events_resolves_fkey"`);
        await queryRunner.query(`ALTER TABLE "events" DROP CONSTRAINT "events_recorded_by_fkey"`);
        await queryRunner.query(`ALTER TABLE "events" DROP CONSTRAINT "events_party_fkey"`);
        await queryRunner.query(`ALTER TABLE "events" DROP CONSTRAINT "events_type_fkey"`);
        await queryRunner.query(`ALTER TABLE "events" DROP CONSTRAINT "events_milestone_fkey"`);
        await queryRunner.query(`ALTER TABLE "milestones" DROP CONSTRAINT "milestones_version_fkey"`);
        await queryRunner.query(`ALTER TABLE "milestones" DROP CONSTRAINT "milestones_contract_fkey"`);
        await queryRunner.query(`ALTER TABLE "contracts" DROP CONSTRAINT "contracts_supplier_fkey"`);
        await queryRunner.query(`ALTER TABLE "contracts" DROP CONSTRAINT "contracts_buyer_fkey"`);
        await queryRunner.query(`ALTER TABLE "contracts" DROP CONSTRAINT "contracts_type_fkey"`);
        await queryRunner.query(`COMMENT ON TABLE "events" IS NULL`);
        await queryRunner.query(`DROP INDEX "public"."events_milestone_idx"`);
        await queryRunner.query(`DROP TABLE "events"`);
        await queryRunner.query(`COMMENT ON TABLE "milestones" IS NULL`);
        await queryRunner.query(`DROP INDEX "public"."milestones_position_key"`);
        await queryRunner.query(`DROP TABLE "milestones"`);
        await queryRunner.query(`COMMENT ON TABLE "contracts" IS NULL`);
        await queryRunner.query(`DROP TABLE "contracts"`);
    }

}
