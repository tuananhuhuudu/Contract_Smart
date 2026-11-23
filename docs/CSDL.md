# Đặc tả cơ sở dữ liệu

Cập nhật: 24/11/2026 · PostgreSQL 17 · ORM TypeORM (model trong `apps/api/src/models`, migration trong `apps/api/migrations`).

- **Thiết kế đích (11 bảng):** `docs/thiet-ke-thu-vien-moc.dbml`, dán vào https://dbdiagram.io/d để xem. Trang bấm thử toàn luồng: http://127.0.0.1:3001/test/luong-v2.html (không ghi DB).
- **Đã dựng thật:** mục 3 (nhóm 1). Các nhóm sau dựng lần lượt, mỗi nhóm xong thì cập nhật tài liệu này.
- Thiết kế cũ (mã nghiệp vụ `CT0001`, `R_GOODS_STD:DELIVERY`, bảng `rule_scopes`, `contract_type_stages`, `rule_versions`) đã bỏ; xem lịch sử git nếu cần.

## 1. Tổng quan

Luồng: **tạo mốc (điều kiện + luật) → ghép mốc vào loại hợp đồng → tạo hợp đồng (chỉnh riêng nếu cần) → ký → ghi sự kiện → engine chấm.**

| Nhóm | Bảng | Trạng thái |
| --- | --- | --- |
| 1. Danh mục, các bên | `event_types`, `parties`, `users` | ✅ Đã dựng |
| 2. Thư viện mốc | `milestone_library`, `milestone_versions`, `payment_rules` | ⏳ |
| 3. Loại hợp đồng | `contract_types`, `contract_type_milestones` | ⏳ |
| 4. Hợp đồng | `contracts`, `milestones`, `events` | ⏳ |
| 5. Chấm, chi tiền, nhật ký | `milestone_evaluations`, `payments`, `audit_log` | ⏳ (thiết kế cột đang chờ duyệt) |

## 2. Quy ước chung

- **Khóa chính là `id` do máy sinh** (`SERIAL`; riêng `users.id` là `uuid`). Người dùng chỉ nhập tên. Bảng nối với nhau bằng `id`.
- **Cột chung** (kế thừa `BaseModel`, `src/models/base.model.ts`): `version` (tăng 1 mỗi lần sửa), `created_at`, `updated_at`.
- **Khóa lạc quan:** API sửa phải gửi `version` đang thấy; lệch thì **409** `VERSION_CONFLICT`.
- **Tiền** dùng `numeric`, đơn vị **triệu VND**, hậu tố `_vnd_mn` (`1000.00` = 1 tỷ đồng); đọc ra là chuỗi, không dùng số thực.
- **Giá trị liệt kê** dùng `text` + `CHECK`. **Danh sách id** dùng mảng `integer[]` (API kiểm từng id có thật).
- Mọi bảng và cột có comment tiếng Việt (DBeaver: nháy đúp bảng → tab Columns).

## 3. Nhóm 1: danh mục, các bên, người dùng

### 3.1 `event_types`: Loại sự kiện

Các nút bấm để ghi sự kiện. Engine **chỉ đọc nhóm** (`category`), không đọc tên, nên thêm loại mới không cần sửa code. Migration nạp sẵn 16 loại (id 1–16).

| Cột | Kiểu | Bắt buộc | Mặc định | Khóa | Ý nghĩa |
| --- | --- | --- | --- | --- | --- |
| `id` | integer | ✓ | tự sinh | PK | Mã loại sự kiện. |
| `name` | text | ✓ |  | UNIQUE | Tên trên nút, ví dụ Giao hàng. |
| `category` | text | ✓ |  |  | EVIDENCE (chứng từ), APPROVAL, REJECTION, DISPUTE_OPEN, DISPUTE_RESOLVE, OTHER. |
| `actor_side` | text |  |  |  | Với chứng từ: BUYER hoặc SUPPLIER ghi; NULL với nhóm khác. |
| `valid_status` | text | ✓ |  |  | Trạng thái API tự điền cho sự kiện loại này (CONFIRMED, APPROVED, REJECTED, OPEN, RESOLVED). |
| `active` | boolean | ✓ | true |  | FALSE: ẩn khỏi danh sách chọn. |

| Nhóm | Bên ghi | Loại (id) |
| --- | --- | --- |
| EVIDENCE | BUYER | Ký hợp đồng (1), Xác nhận khởi động (2), Duyệt yêu cầu (3), Đạt kiểm thử UAT (4), Nghiệm thu (5) |
| EVIDENCE | SUPPLIER | Giao hàng (6), Hóa đơn (7), Đưa vào vận hành (8), Kích hoạt dịch vụ (9), Hoàn thành dịch vụ (10), Hết bảo hành (11) |
| APPROVAL · REJECTION | | Phê duyệt (12) · Từ chối (13) |
| DISPUTE_OPEN · DISPUTE_RESOLVE | | Mở tranh chấp (14) · Đóng tranh chấp (15) |
| OTHER | | Đề nghị đóng hợp đồng (16) |

**Ràng buộc:** tên không rỗng, không trùng; có `actor_side` **khi và chỉ khi** là EVIDENCE; `category`, `valid_status` nằm trong danh sách. **API:** thêm loại mới thì `valid_status` tự suy từ nhóm; không xóa được, chỉ tắt.

### 3.2 `parties`: Các bên

Bên mua, nhà cung cấp, người phê duyệt của bên mua. Là **công ty / vai trò trong hợp đồng**, không phải tài khoản đăng nhập.

| Cột | Kiểu | Bắt buộc | Mặc định | Khóa | Ý nghĩa |
| --- | --- | --- | --- | --- | --- |
| `id` | integer | ✓ | tự sinh | PK | Mã bên. |
| `name` | text | ✓ |  | UNIQUE | Tên, ví dụ Nova An Business JSC. |
| `type` | text | ✓ |  |  | BUYER, SUPPLIER, APPROVER. |
| `parent_id` | integer |  |  | FK → `parties.id` | Bên mua mà người phê duyệt thuộc về. |
| `approval_role` | text |  |  |  | CONTRACT_OWNER, FINANCE_APPROVER, SECONDARY_APPROVER (chỉ người phê duyệt). |
| `approval_limit_vnd_mn` | numeric(18,2) |  |  |  | Hạn mức được duyệt (chỉ người phê duyệt). |
| `allowed_event_type_ids` | integer[] | ✓ | `{}` |  | Loại sự kiện bên này được ghi; engine dùng để phát hiện chứng từ sai thẩm quyền. |
| `active` | boolean | ✓ | true |  | FALSE: không chọn được cho hợp đồng mới. |

**Ràng buộc:** người phê duyệt **phải** có `parent_id` và `approval_role`, bên mua / nhà cung cấp **không** có; hạn mức chỉ với người phê duyệt và ≥ 0; tên không trùng.

### 3.3 `users`: Người dùng

| Cột | Kiểu | Bắt buộc | Mặc định | Khóa | Ý nghĩa |
| --- | --- | --- | --- | --- | --- |
| `id` | uuid | ✓ | gen_random_uuid() | PK | Mã người dùng. |
| `email` | text | ✓ |  | UNIQUE | Email đăng nhập, chữ thường. |
| `password_hash` | text | ✓ |  |  | Mật khẩu đã băm; API không bao giờ trả cột này. |
| `full_name` | text | ✓ |  |  | Họ tên. |
| `role` | text | ✓ |  |  | CONTRACT_OWNER, LEGAL_REVIEWER, FINANCE_APPROVER, SECONDARY_APPROVER, ADMIN_AUDITOR, SUPPLIER, SYSTEM_ADMIN, AUDITOR. |
| `party_id` | integer |  |  | FK → `parties.id` | Bên mà người dùng làm việc cho; NULL với SYSTEM_ADMIN, AUDITOR. |
| `active` | boolean | ✓ | true |  | FALSE: khóa tài khoản. |

**Ràng buộc:** SYSTEM_ADMIN, AUDITOR **không** có bên, các vai trò khác **bắt buộc** có; email viết thường, đúng dạng, không trùng. Chưa có tài khoản nào (chờ API đăng nhập).

## 4. Dữ liệu mẫu

`pnpm db:seed` (trong `apps/api`) đọc `data/datapack/*.csv` của BTC và nạp lại từ đầu (xóa rồi nạp). Mã trong CSV (`B009`, `S021`...) chỉ dùng để nối dòng lúc nạp; DB giữ `id` tự sinh. Hiện nạp: **65 bên** (10 bên mua, 25 nhà cung cấp, 30 người phê duyệt). Quyền `DISPUTE` trong CSV được đổi thành cả Mở tranh chấp và Đóng tranh chấp.

## 5. Migration

| Migration | Nội dung |
| --- | --- |
| `Catalogs` | `event_types` (nạp sẵn 16 loại), `parties`, `users` |

## 6. Lệnh thường dùng

Chạy trong `apps/api`, Postgres đang chạy (`pnpm db:up` ở thư mục gốc).

| Việc | Lệnh |
| --- | --- |
| Sinh migration từ thay đổi trong model | `pnpm db:generate migrations/TenThayDoi` |
| Áp dụng migration | `pnpm db:migrate` |
| Hoàn tác migration gần nhất | `pnpm db:revert` |
| Nạp lại dữ liệu mẫu | `pnpm db:seed` |
| Xem database trên web | Adminer http://127.0.0.1:8080 (PostgreSQL, server `postgres`, user `dev`, mật khẩu `dev`, database `contract_smart`) |
