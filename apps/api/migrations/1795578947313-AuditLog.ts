import { MigrationInterface, QueryRunner } from "typeorm";

export class AuditLog1795578947313 implements MigrationInterface {
    name = 'AuditLog1795578947313'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "audit_log" ("id" bigint NOT NULL, "occurred_at" TIMESTAMP WITH TIME ZONE NOT NULL, "actor_id" uuid, "actor_email" text, "actor_role" text, "actor_organization_id" integer, "action" text NOT NULL, "resource" text NOT NULL, "resource_id" text NOT NULL, "contract_id" integer, "organization_id" integer, "before" jsonb, "after" jsonb, "reason" text NOT NULL DEFAULT '', "prev_hash" character(64) NOT NULL, "hash" character(64) NOT NULL, CONSTRAINT "UQ_8720a34a7f1ebda6f2b3b29f7e3" UNIQUE ("hash"), CONSTRAINT "PK_07fefa57f7f5ab8fc3f52b3ed0b" PRIMARY KEY ("id")); COMMENT ON COLUMN "audit_log"."id" IS 'Số thứ tự trong chuỗi (trigger cấp, liên tục từ 1).'; COMMENT ON COLUMN "audit_log"."occurred_at" IS 'Lúc ghi (trigger đặt bằng giờ máy chủ CSDL).'; COMMENT ON COLUMN "audit_log"."actor_id" IS 'Người làm (users.id); trống: hệ thống làm, ví dụ engine chấm.'; COMMENT ON COLUMN "audit_log"."actor_email" IS 'Email người làm lúc đó (chụp lại).'; COMMENT ON COLUMN "audit_log"."actor_role" IS 'Vai người làm lúc đó (chụp lại, vai có thể đổi sau).'; COMMENT ON COLUMN "audit_log"."actor_organization_id" IS 'Công ty của người làm lúc đó (parties.id, bên mua hoặc nhà cung cấp).'; COMMENT ON COLUMN "audit_log"."action" IS 'Hành động, ví dụ CONTRACT_ACTIVATED, EVENT_RECORDED, PAYMENT_APPROVED.'; COMMENT ON COLUMN "audit_log"."resource" IS 'Loại đối tượng: organization, user, contract, milestone, event, evaluation, payment.'; COMMENT ON COLUMN "audit_log"."resource_id" IS 'Mã đối tượng.'; COMMENT ON COLUMN "audit_log"."contract_id" IS 'Hợp đồng liên quan (contracts.id), để lọc theo hợp đồng và theo bên.'; COMMENT ON COLUMN "audit_log"."organization_id" IS 'Công ty mà dòng này nói tới (tài khoản, khóa công ty), để quản trị công ty xem.'; COMMENT ON COLUMN "audit_log"."before" IS 'Giá trị trước khi đổi (chỉ các trường đổi).'; COMMENT ON COLUMN "audit_log"."after" IS 'Giá trị sau khi đổi, hoặc nội dung mới tạo.'; COMMENT ON COLUMN "audit_log"."reason" IS 'Lý do hoặc ghi chú.'; COMMENT ON COLUMN "audit_log"."prev_hash" IS 'Mã băm của dòng ngay trước (dòng đầu: 64 số 0).'; COMMENT ON COLUMN "audit_log"."hash" IS 'SHA-256 của chính dòng này, kể cả prev_hash.'`);
        await queryRunner.query(`CREATE INDEX "audit_log_actor_organization_idx" ON "audit_log" ("actor_organization_id") `);
        await queryRunner.query(`CREATE INDEX "audit_log_organization_idx" ON "audit_log" ("organization_id") `);
        await queryRunner.query(`CREATE INDEX "audit_log_contract_idx" ON "audit_log" ("contract_id") `);
        await queryRunner.query(`COMMENT ON TABLE "audit_log" IS 'Nhật ký kiểm toán: ai làm gì, lúc nào, trên cái gì. Chỉ thêm; mỗi dòng nối mã băm dòng trước, không sửa, không xóa.'`);
        await queryRunner.query(`ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_organization_fkey" FOREIGN KEY ("actor_organization_id") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_organization_fkey" FOREIGN KEY ("organization_id") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_contract_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);

        // ---------- Hand-written: numbering, hash chain, append-only, verification ----------
        // The exact text an entry's hash covers: every column but the hash, in a fixed order, as a JSON
        // array (jsonb prints keys sorted, so before/after hash the same however they were written).
        await queryRunner.query(`CREATE FUNCTION audit_entry_hash(e audit_log) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT encode(sha256(convert_to(jsonb_build_array(
    e.id, to_char(e.occurred_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    e.actor_id, e.actor_email, e.actor_role, e.actor_organization_id,
    e.action, e.resource, e.resource_id, e.contract_id, e.organization_id,
    e.before, e.after, e.reason, e.prev_hash)::text, 'UTF8')), 'hex')
$$`);
        // One writer at a time (transaction-level lock, released at commit): the new entry takes the next
        // number and links to the last committed entry, so the chain has no fork and no gap.
        await queryRunner.query(`CREATE FUNCTION seal_audit_entry() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE last audit_log%ROWTYPE;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('audit_log'));
  SELECT * INTO last FROM audit_log ORDER BY id DESC LIMIT 1;
  NEW.id := COALESCE(last.id, 0) + 1;
  NEW.prev_hash := COALESCE(last.hash, repeat('0', 64));
  NEW.occurred_at := clock_timestamp();
  NEW.hash := audit_entry_hash(NEW);
  RETURN NEW;
END $$`);
        await queryRunner.query(`CREATE TRIGGER audit_log_seal BEFORE INSERT ON "audit_log" FOR EACH ROW EXECUTE FUNCTION seal_audit_entry()`);
        await queryRunner.query(`CREATE FUNCTION forbid_audit_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'AUDIT_LOCKED: audit entry % cannot be changed or deleted', OLD.id USING ERRCODE = 'check_violation';
END $$`);
        await queryRunner.query(`CREATE TRIGGER audit_log_guard BEFORE UPDATE OR DELETE ON "audit_log" FOR EACH ROW EXECUTE FUNCTION forbid_audit_change()`);
        await queryRunner.query(`CREATE TRIGGER audit_log_no_truncate BEFORE TRUNCATE ON "audit_log" FOR EACH STATEMENT EXECUTE FUNCTION forbid_truncate()`);
        // Walks the chain from entry 1: the first entry whose number, link or hash is wrong, or none.
        await queryRunner.query(`CREATE FUNCTION audit_verify() RETURNS TABLE (checked bigint, broken_id bigint, problem text, head_hash text) LANGUAGE plpgsql STABLE AS $$
DECLARE e audit_log%ROWTYPE; expected_id bigint := 1; expected_prev text := repeat('0', 64);
BEGIN
  checked := 0;
  FOR e IN SELECT * FROM audit_log ORDER BY id LOOP
    IF e.id <> expected_id THEN
      broken_id := expected_id; problem := format('entry %s is missing (next entry is %s)', expected_id, e.id); RETURN NEXT; RETURN;
    END IF;
    IF e.prev_hash <> expected_prev THEN
      broken_id := e.id; problem := format('entry %s does not link to entry %s', e.id, e.id - 1); RETURN NEXT; RETURN;
    END IF;
    IF e.hash <> audit_entry_hash(e) THEN
      broken_id := e.id; problem := format('entry %s was changed after it was written', e.id); RETURN NEXT; RETURN;
    END IF;
    checked := checked + 1; expected_id := e.id + 1; expected_prev := e.hash;
  END LOOP;
  head_hash := expected_prev; RETURN NEXT;
END $$`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP FUNCTION audit_verify()`);
        await queryRunner.query(`DROP TRIGGER audit_log_no_truncate ON "audit_log"`);
        await queryRunner.query(`DROP TRIGGER audit_log_guard ON "audit_log"`);
        await queryRunner.query(`DROP FUNCTION forbid_audit_change()`);
        await queryRunner.query(`DROP TRIGGER audit_log_seal ON "audit_log"`);
        await queryRunner.query(`DROP FUNCTION seal_audit_entry()`);
        await queryRunner.query(`DROP FUNCTION audit_entry_hash(audit_log)`);
        await queryRunner.query(`ALTER TABLE "audit_log" DROP CONSTRAINT "audit_log_contract_fkey"`);
        await queryRunner.query(`ALTER TABLE "audit_log" DROP CONSTRAINT "audit_log_organization_fkey"`);
        await queryRunner.query(`ALTER TABLE "audit_log" DROP CONSTRAINT "audit_log_actor_organization_fkey"`);
        await queryRunner.query(`ALTER TABLE "audit_log" DROP CONSTRAINT "audit_log_actor_fkey"`);
        await queryRunner.query(`COMMENT ON TABLE "audit_log" IS NULL`);
        await queryRunner.query(`DROP INDEX "public"."audit_log_contract_idx"`);
        await queryRunner.query(`DROP INDEX "public"."audit_log_organization_idx"`);
        await queryRunner.query(`DROP INDEX "public"."audit_log_actor_organization_idx"`);
        await queryRunner.query(`DROP TABLE "audit_log"`);
    }

}
