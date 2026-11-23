import { MigrationInterface, QueryRunner } from "typeorm";

export class Events1795425937626 implements MigrationInterface {
    name = 'Events1795425937626'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "events" ("event_id" text NOT NULL, "milestone_id" text NOT NULL, "event_timestamp" TIMESTAMP NOT NULL, "event_type" text NOT NULL, "event_status" text NOT NULL, "actor_party_id" text NOT NULL, "event_source" text NOT NULL DEFAULT 'PORTAL', "document_id" text, "amount_vnd_mn" numeric(18,2), "reference_event_id" text, "event_note" text NOT NULL DEFAULT '', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "events_reference_check" CHECK (("event_type" = 'DISPUTE_RESOLVED') = ("reference_event_id" IS NOT NULL)), CONSTRAINT "events_amount_check" CHECK ("amount_vnd_mn" >= 0), CONSTRAINT "events_source_check" CHECK ("event_source" IN ('PORTAL', 'API', 'WORKFLOW_ENGINE', 'MANUAL_ENTRY')), CONSTRAINT "events_status_check" CHECK ("event_status" IN ('CONFIRMED', 'APPROVED', 'REJECTED', 'OPEN', 'RESOLVED')), CONSTRAINT "events_type_check" CHECK ("event_type" IN ('CONTRACT_SIGNED', 'KICKOFF_CONFIRMED', 'REQUIREMENTS_APPROVED', 'DELIVERY', 'INVOICE', 'UAT_PASSED', 'GO_LIVE', 'ACCEPTANCE', 'SERVICE_ACTIVATED', 'SERVICE_COMPLETED', 'WARRANTY_COMPLETED', 'APPROVAL', 'REJECTION', 'DISPUTE_OPENED', 'DISPUTE_RESOLVED', 'CONTRACT_CLOSE_REQUEST')), CONSTRAINT "PK_1b77463a4487f09e798dffcb43a" PRIMARY KEY ("event_id")); COMMENT ON COLUMN "events"."event_id" IS 'Mã sự kiện, ví dụ EV00003.'; COMMENT ON COLUMN "events"."milestone_id" IS 'Mốc của sự kiện (khóa ngoại tới milestones); hợp đồng suy ra từ mốc.'; COMMENT ON COLUMN "events"."event_timestamp" IS 'Thời điểm xảy ra (không múi giờ, như dữ liệu của đề).'; COMMENT ON COLUMN "events"."event_type" IS 'Loại sự kiện, ví dụ DELIVERY, INVOICE, APPROVAL, DISPUTE_OPENED.'; COMMENT ON COLUMN "events"."event_status" IS 'CONFIRMED, APPROVED, REJECTED, OPEN hoặc RESOLVED.'; COMMENT ON COLUMN "events"."actor_party_id" IS 'Bên thực hiện (khóa ngoại tới parties); loại bên và vai trò lấy từ parties.'; COMMENT ON COLUMN "events"."event_source" IS 'Kênh: PORTAL, API, WORKFLOW_ENGINE, MANUAL_ENTRY.'; COMMENT ON COLUMN "events"."document_id" IS 'Mã chứng từ kèm theo.'; COMMENT ON COLUMN "events"."amount_vnd_mn" IS 'Số tiền gắn với sự kiện (hóa đơn, phê duyệt), triệu VND.'; COMMENT ON COLUMN "events"."reference_event_id" IS 'Chỉ với DISPUTE_RESOLVED: sự kiện DISPUTE_OPENED được đóng.'; COMMENT ON COLUMN "events"."event_note" IS 'Ghi chú ngắn.'; COMMENT ON COLUMN "events"."created_at" IS 'Thời điểm ghi vào hệ thống.'`);
        await queryRunner.query(`CREATE INDEX "events_type_idx" ON "events" ("event_type") `);
        await queryRunner.query(`CREATE INDEX "events_actor_idx" ON "events" ("actor_party_id") `);
        await queryRunner.query(`CREATE INDEX "events_milestone_time_idx" ON "events" ("milestone_id", "event_timestamp") `);
        await queryRunner.query(`COMMENT ON TABLE "events" IS 'Sự kiện đã xảy ra trong hợp đồng (giao hàng, hóa đơn, phê duyệt, tranh chấp...). Chỉ thêm, không sửa, không xóa.'`);
        await queryRunner.query(`ALTER TABLE "events" ADD CONSTRAINT "events_milestone_fkey" FOREIGN KEY ("milestone_id") REFERENCES "milestones"("milestone_id") ON DELETE RESTRICT ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "events" ADD CONSTRAINT "events_actor_fkey" FOREIGN KEY ("actor_party_id") REFERENCES "parties"("party_id") ON DELETE RESTRICT ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "events" ADD CONSTRAINT "events_reference_fkey" FOREIGN KEY ("reference_event_id") REFERENCES "events"("event_id") ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY DEFERRED`);

        // ---------- Hand-written: events are append-only ----------
        await queryRunner.query(`CREATE FUNCTION forbid_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'APPEND_ONLY_TABLE: % cannot be changed or deleted', TG_TABLE_NAME USING ERRCODE = 'check_violation';
END $$`);
        await queryRunner.query(`CREATE TRIGGER events_append_only BEFORE UPDATE OR DELETE ON "events" FOR EACH ROW EXECUTE FUNCTION forbid_change()`);
        // TRUNCATE skips row triggers, so it is blocked on its own.
        await queryRunner.query(`CREATE TRIGGER events_no_truncate BEFORE TRUNCATE ON "events" FOR EACH STATEMENT EXECUTE FUNCTION forbid_change()`);

        // The engine reads the organiser's 16 columns; rebuild the 5 that are not stored.
        await queryRunner.query(`CREATE VIEW engine_events AS
SELECT e.event_id, m.contract_id, e.milestone_id,
       row_number() OVER (PARTITION BY m.contract_id ORDER BY e.event_timestamp, e.event_id) AS contract_event_sequence,
       to_char(e.event_timestamp, 'YYYY-MM-DD"T"HH24:MI:SS') AS event_timestamp,
       e.event_type, e.event_status, e.actor_party_id, p.party_type AS actor_party_type,
       CASE WHEN p.party_type = 'APPROVER' THEN p.approval_role ELSE p.party_type END AS actor_role,
       e.event_source, e.document_id, e.amount_vnd_mn, e.reference_event_id, e.event_note,
       true AS data_is_synthetic
FROM events e
JOIN milestones m ON m.milestone_id = e.milestone_id
JOIN parties p ON p.party_id = e.actor_party_id`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP VIEW engine_events`);
        await queryRunner.query(`DROP TRIGGER events_no_truncate ON "events"`);
        await queryRunner.query(`DROP TRIGGER events_append_only ON "events"`);
        await queryRunner.query(`DROP FUNCTION forbid_change()`);

        await queryRunner.query(`ALTER TABLE "events" DROP CONSTRAINT "events_reference_fkey"`);
        await queryRunner.query(`ALTER TABLE "events" DROP CONSTRAINT "events_actor_fkey"`);
        await queryRunner.query(`ALTER TABLE "events" DROP CONSTRAINT "events_milestone_fkey"`);
        await queryRunner.query(`COMMENT ON TABLE "events" IS NULL`);
        await queryRunner.query(`DROP INDEX "public"."events_milestone_time_idx"`);
        await queryRunner.query(`DROP INDEX "public"."events_actor_idx"`);
        await queryRunner.query(`DROP INDEX "public"."events_type_idx"`);
        await queryRunner.query(`DROP TABLE "events"`);
    }

}
