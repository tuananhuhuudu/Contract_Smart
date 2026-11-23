import { MigrationInterface, QueryRunner } from "typeorm";

export class EventTypes1795429556831 implements MigrationInterface {
    name = 'EventTypes1795429556831'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "events" DROP CONSTRAINT "events_type_check"`);
        await queryRunner.query(`CREATE TABLE "event_types" ("version" integer NOT NULL DEFAULT '1', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "code" text NOT NULL, "name" text NOT NULL, "category" text NOT NULL, "actor_side" text, "active" boolean NOT NULL DEFAULT true, CONSTRAINT "event_types_evidence_side_check" CHECK (("category" = 'EVIDENCE') = ("actor_side" IS NOT NULL)), CONSTRAINT "event_types_side_check" CHECK ("actor_side" IN ('BUYER', 'SUPPLIER')), CONSTRAINT "event_types_category_check" CHECK ("category" IN ('EVIDENCE', 'APPROVAL', 'REJECTION', 'DISPUTE_OPEN', 'DISPUTE_RESOLVE', 'OTHER')), CONSTRAINT "event_types_name_check" CHECK (length(trim("name")) > 0), CONSTRAINT "event_types_code_check" CHECK ("code" ~ '^[A-Z][A-Z0-9_]*$'), CONSTRAINT "PK_e317f07d9a82db10adb2f4435ef" PRIMARY KEY ("code")); COMMENT ON COLUMN "event_types"."version" IS 'Số phiên bản, tăng mỗi lần sửa (khóa lạc quan).'; COMMENT ON COLUMN "event_types"."created_at" IS 'Thời điểm tạo dòng.'; COMMENT ON COLUMN "event_types"."updated_at" IS 'Thời điểm sửa gần nhất.'; COMMENT ON COLUMN "event_types"."code" IS 'Mã loại sự kiện, ví dụ DELIVERY.'; COMMENT ON COLUMN "event_types"."name" IS 'Tên hiển thị, ví dụ Giao hàng.'; COMMENT ON COLUMN "event_types"."category" IS 'Nhóm: EVIDENCE (chứng từ), APPROVAL, REJECTION, DISPUTE_OPEN, DISPUTE_RESOLVE, OTHER.'; COMMENT ON COLUMN "event_types"."actor_side" IS 'Với chứng từ: bên được ghi (BUYER hoặc SUPPLIER); NULL với các nhóm khác.'; COMMENT ON COLUMN "event_types"."active" IS 'FALSE: không chọn được cho mốc mẫu và sự kiện mới.'`);
        await queryRunner.query(`COMMENT ON TABLE "event_types" IS 'Danh mục loại sự kiện. Sự kiện và mốc mẫu chỉ dùng được loại có trong danh mục.'`);

        // ---------- Hand-written: the 16 event types of the Data Pack, before events point at them ----------
        // Categories and the recording side follow docs/NGHIEP_VU.md section 2.1.
        await queryRunner.query(`INSERT INTO "event_types" (code, name, category, actor_side) VALUES
('CONTRACT_SIGNED', 'Ký hợp đồng', 'EVIDENCE', 'BUYER'),
('KICKOFF_CONFIRMED', 'Xác nhận khởi động', 'EVIDENCE', 'BUYER'),
('REQUIREMENTS_APPROVED', 'Duyệt yêu cầu', 'EVIDENCE', 'BUYER'),
('UAT_PASSED', 'Đạt kiểm thử người dùng (UAT)', 'EVIDENCE', 'BUYER'),
('ACCEPTANCE', 'Nghiệm thu', 'EVIDENCE', 'BUYER'),
('DELIVERY', 'Giao hàng', 'EVIDENCE', 'SUPPLIER'),
('INVOICE', 'Hóa đơn', 'EVIDENCE', 'SUPPLIER'),
('GO_LIVE', 'Đưa vào vận hành', 'EVIDENCE', 'SUPPLIER'),
('SERVICE_ACTIVATED', 'Kích hoạt dịch vụ', 'EVIDENCE', 'SUPPLIER'),
('SERVICE_COMPLETED', 'Hoàn thành dịch vụ', 'EVIDENCE', 'SUPPLIER'),
('WARRANTY_COMPLETED', 'Hết bảo hành', 'EVIDENCE', 'SUPPLIER'),
('APPROVAL', 'Phê duyệt', 'APPROVAL', NULL),
('REJECTION', 'Từ chối', 'REJECTION', NULL),
('DISPUTE_OPENED', 'Mở tranh chấp', 'DISPUTE_OPEN', NULL),
('DISPUTE_RESOLVED', 'Đóng tranh chấp', 'DISPUTE_RESOLVE', NULL),
('CONTRACT_CLOSE_REQUEST', 'Đề nghị đóng hợp đồng', 'OTHER', NULL)`);
        await queryRunner.query(`COMMENT ON COLUMN "events"."event_type" IS 'Loại sự kiện (khóa ngoại tới event_types), ví dụ DELIVERY, INVOICE, APPROVAL.'`);
        await queryRunner.query(`ALTER TABLE "events" ADD CONSTRAINT "events_event_type_fkey" FOREIGN KEY ("event_type") REFERENCES "event_types"("code") ON DELETE RESTRICT ON UPDATE CASCADE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "events" DROP CONSTRAINT "events_event_type_fkey"`);
        await queryRunner.query(`COMMENT ON COLUMN "events"."event_type" IS 'Loại sự kiện, ví dụ DELIVERY, INVOICE, APPROVAL, DISPUTE_OPENED.'`);
        await queryRunner.query(`COMMENT ON TABLE "event_types" IS NULL`);
        await queryRunner.query(`DROP TABLE "event_types"`);
        await queryRunner.query(`ALTER TABLE "events" ADD CONSTRAINT "events_type_check" CHECK ((event_type = ANY (ARRAY['CONTRACT_SIGNED'::text, 'KICKOFF_CONFIRMED'::text, 'REQUIREMENTS_APPROVED'::text, 'DELIVERY'::text, 'INVOICE'::text, 'UAT_PASSED'::text, 'GO_LIVE'::text, 'ACCEPTANCE'::text, 'SERVICE_ACTIVATED'::text, 'SERVICE_COMPLETED'::text, 'WARRANTY_COMPLETED'::text, 'APPROVAL'::text, 'REJECTION'::text, 'DISPUTE_OPENED'::text, 'DISPUTE_RESOLVED'::text, 'CONTRACT_CLOSE_REQUEST'::text])))`);
    }

}
