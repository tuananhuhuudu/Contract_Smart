# Đặc tả cơ sở dữ liệu

Cập nhật: 23/11/2026 · PostgreSQL 17 · ORM TypeORM (model trong `apps/api/src/models`, migration trong `apps/api/migrations`).

Tài liệu này mô tả **các bảng đang có thật** trong database. Sơ đồ quan hệ: `docs/database.dbml` (dán vào https://dbdiagram.io/d). Bản thiết kế ban đầu ở `docs/THIET_KE_CSDL.md` chỉ còn giá trị tham khảo; khi khác nhau, tài liệu này và các model là chuẩn.

## 1. Tổng quan

Có **8 bảng**, chia 2 nhóm, phục vụ luồng: loại hợp đồng → khuôn mốc + bộ luật → phiên bản luật → hợp đồng → mốc → (engine chấm từng mốc).

| Nhóm | Bảng | Vai trò |
| --- | --- | --- |
| Cấu hình | `contract_types` | Loại hợp đồng |
| | `rule_scopes` | Tên bộ luật cho một loại mốc |
| | `contract_type_stages` | Khuôn mốc (mốc mẫu) của một loại hợp đồng |
| | `rule_versions` | Phiên bản luật |
| | `payment_rules` | Các luật "nếu ... thì ..." |
| Hợp đồng | `parties` | Bên mua, nhà cung cấp, người phê duyệt |
| | `contracts` | Hợp đồng |
| | `milestones` | Mốc thanh toán thật của hợp đồng |

```
contract_types ──< rule_scopes ──< payment_rules >── rule_versions
      │   └──< contract_type_stages ──> rule_scopes           │
      └──< contracts >── parties                              │
              │   └──────────────── rule_versions <───────────┘
              └──< milestones ──> rule_scopes
```
`A ──< B`: một A có nhiều B. `A ──> B`: A trỏ tới B.

**Engine chọn luật cho một mốc** bằng hai thông tin: bộ luật lấy từ mốc (`milestones.release_rule_code`), phiên bản lấy từ hợp đồng (`contracts.rule_version_id`):

```sql
SELECT * FROM payment_rules
WHERE release_rule_code = <bộ luật của mốc> AND rule_version_id = <phiên bản của hợp đồng>
ORDER BY priority;   -- luật đầu tiên khớp thắng
```

## 2. Quy ước chung

- **Cột chung** (kế thừa `BaseModel`, `src/models/base.model.ts`): `version` (tăng 1 mỗi lần sửa), `created_at`, `updated_at`.
- **Khóa lạc quan:** mọi API sửa/xóa gửi kèm `version` đang thấy; lệch thì trả **409** `VERSION_CONFLICT`, không ghi đè.
- **Khóa chính là mã nghiệp vụ** (`GOODS_SUPPLY`, `CT0001`, `MS0001`, `PR0001`). Mã hợp đồng, mốc, luật do API cấp tự động, không trùng kể cả khi nhiều người tạo cùng lúc.
- **Tiền** dùng `numeric`, đơn vị **triệu VND**, hậu tố `_vnd_mn`; đọc ra là chuỗi (`"516.00"`), không bao giờ là số thực. Chia tiền theo % làm tròn tới đồng, phần lẻ dồn vào mốc cuối.
- **Ngày** dùng `date` (`'2026-06-08'`), không múi giờ.
- **Danh sách** (giấy tờ bắt buộc, sự kiện được phép) dùng `text[]`, ví dụ `{DELIVERY,INVOICE}`.
- **Giá trị liệt kê** dùng `text` + `CHECK`.
- **Không lưu cột suy ra được.** Cột Data Pack nào là hằng số hoặc tính lại được từ bảng khác thì không lưu; 4 view `engine_*` dựng lại đủ cột theo đúng định dạng Data Pack cho engine (mục 4).
- Mọi bảng và cột có comment tiếng Việt (DBeaver: nháy đúp bảng → tab Columns).

## 3. Các bảng

### 3.1 `contract_types`: Loại hợp đồng

Một loại hợp đồng (hàng hóa, dịch vụ...). Khuôn mốc của loại là các dòng `contract_type_stages`, các bộ luật là các dòng `rule_scopes`. Mã khuôn (`WF_GOODS_4STAGE`) và mã bộ luật lớn (`R_GOODS_STD`) của Data Pack không lưu: view `contract_type_labels` dựng lại cho engine.

Được trỏ tới bởi: `rule_scopes.contract_type`, `contract_type_stages.contract_type`, `contracts.contract_type`.

| Cột | Kiểu | Bắt buộc | Mặc định | Khóa | Ý nghĩa |
| --- | --- | --- | --- | --- | --- |
| `version` | integer | ✓ | 1 |  | Số phiên bản, tăng mỗi lần sửa (khóa lạc quan). |
| `created_at` | timestamptz | ✓ | now() |  | Thời điểm tạo dòng. |
| `updated_at` | timestamptz | ✓ | now() |  | Thời điểm sửa gần nhất. |
| `code` | text | ✓ |  | PK | Mã loại hợp đồng, chữ hoa và gạch dưới, ví dụ GOODS_SUPPLY. |
| `name` | text | ✓ |  |  | Tên hiển thị, ví dụ Cung cấp hàng hóa. |
| `active` | boolean | ✓ | true |  | FALSE: không tạo hợp đồng mới thuộc loại này được nữa. |

**Ràng buộc**

- `contract_types_code_check`: `((code ~ '^[A-Z][A-Z0-9_]*$'::text))`
- `contract_types_name_check`: `((length(TRIM(BOTH FROM name)) > 0))`

### 3.2 `rule_scopes`: Bộ luật

**Tên** một bộ luật cho một loại mốc của một loại hợp đồng, ví dụ `R_GOODS_STD:DELIVERY`. Bảng **không chứa luật**: các luật là dòng `payment_rules` trỏ về đây (mỗi phiên bản luật một bộ). Phần sau dấu `:` là loại mốc; mọi bộ luật của cùng một loại hợp đồng chung phần trước dấu `:` (API kiểm khi tạo).

Được trỏ tới bởi: `contract_type_stages`, `milestones`, `payment_rules` (cột `release_rule_code`).

| Cột | Kiểu | Bắt buộc | Mặc định | Khóa | Ý nghĩa |
| --- | --- | --- | --- | --- | --- |
| `version` | integer | ✓ | 1 |  | Số phiên bản, tăng mỗi lần sửa (khóa lạc quan). |
| `created_at` | timestamptz | ✓ | now() |  | Thời điểm tạo dòng. |
| `updated_at` | timestamptz | ✓ | now() |  | Thời điểm sửa gần nhất. |
| `release_rule_code` | text | ✓ |  | PK | Mã bộ luật, dạng `<bộ luật>:<loại mốc>`, ví dụ R_GOODS_STD:DELIVERY. |
| `contract_type` | text | ✓ |  | FK → `contract_types(code)` | Loại hợp đồng của bộ luật (khóa ngoại tới contract_types). |
| `milestone_type` | text | ✓ |  |  | Loại mốc mà bộ luật này chấm, ví dụ DELIVERY. Mỗi loại hợp đồng có tối đa một bộ cho mỗi loại mốc. |
| `name` | text | ✓ |  |  | Tên hiển thị, ví dụ Giao hàng - hàng hóa. |

**Ràng buộc**

- `rule_scopes_code_check`: `((release_rule_code ~ '^[A-Z][A-Z0-9_]*:[A-Z][A-Z0-9_]*$'::text))`
- `rule_scopes_contract_type_milestone_type_key`: không trùng (contract_type, milestone_type)
- `rule_scopes_contract_type_release_rule_code_key`: không trùng (contract_type, release_rule_code)
- `rule_scopes_milestone_type_check`: `((milestone_type ~ '^[A-Z][A-Z0-9_]*$'::text))`
- `rule_scopes_name_check`: `((length(TRIM(BOTH FROM name)) > 0))`

### 3.3 `contract_type_stages`: Khuôn mốc

Khuôn mốc: mỗi dòng là một mốc **mẫu** của một loại hợp đồng. Khi tạo hợp đồng, mỗi dòng sinh ra một dòng `milestones`: tiền = `payment_percent` × giá trị hợp đồng, hạn = ngày bắt đầu + `offset_days`, còn giấy tờ bắt buộc, cờ hóa đơn, cờ phạt trễ và bộ luật được chép sang. Sửa khuôn sau đó không làm đổi hợp đồng đã tạo.

Mốc mẫu chỉ trỏ tới **bộ luật** (`rule_scopes`), không nối thẳng với `payment_rules`. Khóa ghép (`contract_type`, `release_rule_code`) bảo đảm mốc chỉ chọn được bộ luật **cùng loại hợp đồng**. Tổng `payment_percent` các mốc của một loại không quá 100 (API kiểm khi thêm/sửa); tạo hợp đồng thì phải đúng 100.

| Cột | Kiểu | Bắt buộc | Mặc định | Khóa | Ý nghĩa |
| --- | --- | --- | --- | --- | --- |
| `version` | integer | ✓ | 1 |  | Số phiên bản, tăng mỗi lần sửa (khóa lạc quan). |
| `created_at` | timestamptz | ✓ | now() |  | Thời điểm tạo dòng. |
| `updated_at` | timestamptz | ✓ | now() |  | Thời điểm sửa gần nhất. |
| `contract_type` | text | ✓ |  | PK<br>FK → `rule_scopes(contract_type, release_rule_code)`<br>FK → `contract_types(code)` | Loại hợp đồng của mốc mẫu. |
| `sequence` | integer | ✓ |  | PK | Thứ tự mốc trong khuôn (1, 2, 3...). |
| `milestone_type` | text | ✓ |  |  | Loại mốc, ví dụ DELIVERY. |
| `name` | text | ✓ |  |  | Tên mốc, ví dụ Giao hàng. |
| `payment_percent` | numeric(5,2) | ✓ |  |  | % giá trị hợp đồng trả ở mốc này; tổng các mốc của một loại phải là 100 (API kiểm). |
| `required_event_types` | text[] | ✓ |  |  | Sự kiện bắt buộc để mốc được trả, ví dụ {DELIVERY, INVOICE}. |
| `invoice_required` | boolean | ✓ | false |  | Mốc có cần hóa đơn không. |
| `late_penalty_applicable` | boolean | ✓ | false |  | Mốc có tính phạt trễ không. |
| `offset_days` | integer | ✓ | 0 |  | Hạn của mốc = ngày bắt đầu hợp đồng + số ngày này (người dùng sửa được trước khi chốt). |
| `release_rule_code` | text | ✓ |  | FK → `rule_scopes(contract_type, release_rule_code)` | Bộ luật chấm mốc sinh ra từ dòng này; phải cùng loại hợp đồng. |

**Ràng buộc**

- `stages_events_check`: `((cardinality(required_event_types) >= 1))`
- `stages_name_check`: `((length(TRIM(BOTH FROM name)) > 0))`
- `stages_offset_check`: `((offset_days >= 0))`
- `stages_percent_check`: `(((payment_percent > (0)::numeric) AND (payment_percent <= (100)::numeric)))`
- `stages_sequence_check`: `((sequence >= 1))`

### 3.4 `rule_versions`: Phiên bản luật

Một phiên bản của **toàn bộ** luật. Vòng đời chỉ đi tiến: `DRAFT` (đang soạn, sửa được) → `PUBLISHED` (đang dùng, luật bị khóa) → `RETIRED` (ngừng dùng cho hợp đồng mới). Công bố bản mới thì bản đang dùng chuyển sang `RETIRED`. Hợp đồng giữ phiên bản lúc tạo (`contracts.rule_version_id`), nên mọi quyết định cũ vẫn giải thích được bằng đúng bộ luật đã dùng.

Trigger: `rule_versions_status_guard` chặn đi lùi trạng thái. `created_by`, `published_by` sẽ nối khóa ngoại tới `users` khi có bảng này.

| Cột | Kiểu | Bắt buộc | Mặc định | Khóa | Ý nghĩa |
| --- | --- | --- | --- | --- | --- |
| `version` | integer | ✓ | 1 |  | Số phiên bản, tăng mỗi lần sửa (khóa lạc quan). |
| `created_at` | timestamptz | ✓ | now() |  | Thời điểm tạo dòng. |
| `updated_at` | timestamptz | ✓ | now() |  | Thời điểm sửa gần nhất. |
| `id` | text | ✓ |  | PK | Mã phiên bản, ví dụ v1. |
| `name` | text | ✓ |  |  | Tên phiên bản, ví dụ Data Pack. |
| `status` | text | ✓ | 'DRAFT' |  | DRAFT (đang soạn, sửa được) -> PUBLISHED (đang dùng, khóa) -> RETIRED (ngừng dùng cho hợp đồng mới). |
| `note` | text |  |  |  | Ghi chú thay đổi của phiên bản. |
| `created_by` | uuid |  |  |  | Người soạn; NULL với phiên bản của Data Pack. |
| `published_by` | uuid |  |  |  | Người công bố; phải khác người soạn. |
| `published_at` | timestamptz |  |  |  | Thời điểm công bố. |

**Ràng buộc**

- `rule_versions_name_check`: `((length(TRIM(BOTH FROM name)) > 0))`
- `rule_versions_published_check`: `(((status = 'DRAFT'::text) = (published_at IS NULL)))`
- `rule_versions_status_check`: `((status = ANY (ARRAY['DRAFT'::text, 'PUBLISHED'::text, 'RETIRED'::text])))`
- `rule_versions_two_people_check`: `(((published_by IS NULL) OR (created_by IS NULL) OR (published_by <> created_by)))`

### 3.5 `payment_rules`: Luật thanh toán

Một luật "nếu ... thì ...". Engine lấy các luật có **bộ = bộ luật của mốc** và **phiên bản = phiên bản của hợp đồng**, xét theo `priority` tăng dần, luật đầu tiên khớp thắng. Luật cuối mỗi bộ phải là `ELSE` (API kiểm khi công bố). Các cột Data Pack mô tả bộ luật (`rule_set_id`, `workflow_template`, `contract_type`, `applies_to_milestone_type`) và các hằng số (`evaluation_order`, `stop_processing`, `parameter_source`) không lưu: view `engine_payment_rules` dựng lại.

Trigger: `payment_rules_version_frozen` chặn thêm/sửa/xóa luật của phiên bản không còn là `DRAFT` (trả 409 `RULE_VERSION_IS_FROZEN`).

| Cột | Kiểu | Bắt buộc | Mặc định | Khóa | Ý nghĩa |
| --- | --- | --- | --- | --- | --- |
| `version` | integer | ✓ | 1 |  | Số phiên bản, tăng mỗi lần sửa (khóa lạc quan). |
| `created_at` | timestamptz | ✓ | now() |  | Thời điểm tạo dòng. |
| `updated_at` | timestamptz | ✓ | now() |  | Thời điểm sửa gần nhất. |
| `rule_id` | text | ✓ |  | PK | Mã luật duy nhất, ví dụ PR0015. |
| `rule_version_id` | text | ✓ |  | FK → `rule_versions(id)` | Phiên bản luật chứa luật này. |
| `release_rule_code` | text | ✓ |  | FK → `rule_scopes(release_rule_code)` | Bộ luật (rule_scopes) của luật, ví dụ R_GOODS_STD:DELIVERY. |
| `priority` | integer | ✓ |  |  | Độ ưu tiên; số nhỏ được xét trước. |
| `rule_name` | text | ✓ |  |  | Tên ngắn của luật. |
| `rule_group` | text | ✓ |  |  | Nhóm: BLOCKING, VALIDATION, PENALTY, RELEASE, FALLBACK. |
| `condition_expression` | text | ✓ |  |  | Điều kiện, ví dụ open_dispute == TRUE; ELSE cho luật cuối. |
| `decision` | text | ✓ |  |  | Quyết định khi khớp: RELEASE, HOLD, REJECT, PENALTY. |
| `reason_code` | text | ✓ |  |  | Mã lý do, ví dụ OPEN_DISPUTE. |
| `payable_amount_formula` | text | ✓ |  |  | Công thức số tiền được trả (triệu VND). |
| `penalty_amount_formula` | text | ✓ |  |  | Công thức tiền phạt (triệu VND). |
| `rule_description_vi` | text | ✓ |  |  | Mô tả luật bằng tiếng Việt. |
| `active` | boolean | ✓ | true |  | Luật đang được dùng. |

**Ràng buộc**

- `payment_rules_decision_check`: `((decision = ANY (ARRAY['RELEASE'::text, 'HOLD'::text, 'REJECT'::text, 'PENALTY'::text])))`
- `payment_rules_group_check`: `((rule_group = ANY (ARRAY['BLOCKING'::text, 'VALIDATION'::text, 'PENALTY'::text, 'RELEASE'::text, 'FALLBACK'::text])))`
- `payment_rules_priority_check`: `((priority > 0))`
- `payment_rules_version_scope_priority_key`: không trùng (rule_version_id, release_rule_code, priority)

### 3.6 `parties`: Các bên

Các bên của Data Pack: bên mua (`Bxxx`), nhà cung cấp (`Sxxx`), người phê duyệt của bên mua (`Axxx`, có `parent_party_id`). Đây là **công ty / vai trò trong hợp đồng**, không phải tài khoản đăng nhập; người dùng (`users`, chưa làm) sẽ trỏ tới bên mà họ đại diện. Các cột quyền (`allowed_event_types`, `can_approve_payment`, `approval_limit_vnd_mn`) là **quyền nghiệp vụ** engine dùng để kiểm sự kiện hợp lệ.

| Cột | Kiểu | Bắt buộc | Mặc định | Khóa | Ý nghĩa |
| --- | --- | --- | --- | --- | --- |
| `version` | integer | ✓ | 1 |  | Số phiên bản, tăng mỗi lần sửa (khóa lạc quan). |
| `created_at` | timestamptz | ✓ | now() |  | Thời điểm tạo dòng. |
| `updated_at` | timestamptz | ✓ | now() |  | Thời điểm sửa gần nhất. |
| `party_id` | text | ✓ |  | PK | Mã bên: Bxxx bên mua, Sxxx nhà cung cấp, Axxx người phê duyệt. |
| `party_name` | text | ✓ |  |  | Tên của bên. |
| `party_type` | text | ✓ |  |  | BUYER, SUPPLIER hoặc APPROVER. |
| `parent_party_id` | text |  |  | FK → `parties(party_id)` | Bên mua mà người phê duyệt thuộc về; NULL với bên mua và nhà cung cấp. |
| `organization_category` | text | ✓ |  |  | Lĩnh vực hoạt động. |
| `region` | text | ✓ |  |  | Khu vực, ví dụ HANOI. |
| `approval_role` | text | ✓ | 'NONE' |  | Vai trò phê duyệt; NONE với bên mua và nhà cung cấp. |
| `approval_level` | integer | ✓ | 0 |  | Cấp phê duyệt (0, 1, 2). |
| `approval_limit_vnd_mn` | numeric(18,2) |  |  |  | Hạn mức được duyệt (triệu VND). |
| `allowed_event_types` | text[] | ✓ | '{}'[] |  | Các loại sự kiện bên này được ghi. |
| `can_approve_payment` | boolean | ✓ | false |  | Được duyệt thanh toán không. |
| `can_raise_dispute` | boolean | ✓ | false |  | Được mở tranh chấp không. |
| `status` | text | ✓ | 'ACTIVE' |  | ACTIVE hoặc INACTIVE. |

**Ràng buộc**

- `parties_approval_level_check`: `((approval_level >= 0))`
- `parties_approval_role_check`: `((approval_role = ANY (ARRAY['NONE'::text, 'CONTRACT_OWNER'::text, 'FINANCE_APPROVER'::text, 'SECONDARY_APPROVER'::text])))`
- `parties_limit_check`: `((approval_limit_vnd_mn >= (0)::numeric))`
- `parties_parent_check`: `(((party_type = 'APPROVER'::text) = (parent_party_id IS NOT NULL)))`
- `parties_status_check`: `((status = ANY (ARRAY['ACTIVE'::text, 'INACTIVE'::text])))`
- `parties_type_check`: `((party_type = ANY (ARRAY['BUYER'::text, 'SUPPLIER'::text, 'APPROVER'::text])))`

### 3.7 `contracts`: Hợp đồng

Một hợp đồng giữa bên mua và nhà cung cấp; tiền trả theo các mốc trong `milestones`. `rule_version_id` ghi phiên bản luật dùng để chấm. Các cột Data Pack suy ra được không lưu: `workflow_template`, `rule_set_id` (từ loại), `approval_quorum`, `auto_release_allowed` (từ `approval_policy`), `currency`, `initial_contract_status`, `data_is_synthetic` (hằng số); view `engine_contracts` dựng lại.

Tạo qua API `POST /contracts`: hợp đồng ở `DRAFT`, các mốc sinh từ khuôn trong cùng transaction, mã `CTxxxx` cấp tự động.

| Cột | Kiểu | Bắt buộc | Mặc định | Khóa | Ý nghĩa |
| --- | --- | --- | --- | --- | --- |
| `version` | integer | ✓ | 1 |  | Số phiên bản, tăng mỗi lần sửa (khóa lạc quan). |
| `created_at` | timestamptz | ✓ | now() |  | Thời điểm tạo dòng. |
| `updated_at` | timestamptz | ✓ | now() |  | Thời điểm sửa gần nhất. |
| `contract_id` | text | ✓ |  | PK | Mã hợp đồng, ví dụ CT0001. |
| `contract_title` | text | ✓ |  |  | Tên hợp đồng. |
| `contract_type` | text | ✓ |  | FK → `contract_types(code)` | Loại hợp đồng (khóa ngoại tới contract_types); khuôn mốc và bộ luật lấy từ loại. |
| `buyer_id` | text | ✓ |  | FK → `parties(party_id)` | Bên mua (khóa ngoại tới parties). |
| `supplier_id` | text | ✓ |  | FK → `parties(party_id)` | Nhà cung cấp (khóa ngoại tới parties), khác bên mua. |
| `contract_value_vnd_mn` | numeric(18,2) | ✓ |  |  | Giá trị hợp đồng (triệu VND). |
| `signing_date` | date | ✓ |  |  | Ngày ký. |
| `start_date` | date | ✓ |  |  | Ngày bắt đầu (không sớm hơn ngày ký). |
| `end_date` | date | ✓ |  |  | Ngày kết thúc theo kế hoạch. |
| `rule_version_id` | text | ✓ |  | FK → `rule_versions(id)` | Phiên bản luật dùng để chấm hợp đồng này; giữ nguyên khi có phiên bản mới. |
| `approval_policy` | text | ✓ |  |  | Chính sách phê duyệt: tự động, một người, hai người... |
| `grace_period_days` | integer | ✓ | 0 |  | Số ngày ân hạn trước khi tính phạt. |
| `penalty_rate_pct_per_day` | numeric(7,4) | ✓ | '0'::numeric |  | % phạt mỗi ngày trễ. |
| `max_penalty_pct` | numeric(7,4) | ✓ | '0'::numeric |  | Trần phạt tối đa (%). |
| `lifecycle` | text | ✓ | 'DRAFT' |  | Vòng đời trong ứng dụng: DRAFT, SIGNING, ACTIVE, CLOSED. |

**Ràng buộc**

- `contracts_dates_check`: `(((start_date >= signing_date) AND (end_date >= start_date)))`
- `contracts_lifecycle_check`: `((lifecycle = ANY (ARRAY['DRAFT'::text, 'SIGNING'::text, 'ACTIVE'::text, 'CLOSED'::text])))`
- `contracts_numbers_check`: `(((grace_period_days >= 0) AND (penalty_rate_pct_per_day >= (0)::numeric) AND (max_penalty_pct >= (0)::numeric)))`
- `contracts_parties_check`: `((buyer_id <> supplier_id))`
- `contracts_policy_check`: `((approval_policy = ANY (ARRAY['AUTO_IF_ALL_CONDITIONS'::text, 'SINGLE_BUYER_APPROVAL'::text, 'DUAL_APPROVAL'::text, 'FINANCE_PLUS_OWNER'::text])))`
- `contracts_value_check`: `((contract_value_vnd_mn >= (0)::numeric))`

### 3.8 `milestones`: Mốc thanh toán

Một mốc thanh toán **thật** của một hợp đồng. Chỉ giữ những gì riêng của mốc: thứ tự, tên, hạn, số tiền, giấy tờ bắt buộc, cờ hóa đơn, cờ phạt trễ, bộ luật. Những gì suy ra từ hợp đồng hoặc bộ luật không lưu (loại mốc, %, số người duyệt và vai trò, ân hạn, % phạt, trần phạt, câu điều kiện, hằng số); view `engine_milestones` dựng lại.

Engine chấm **từng mốc**: lấy bộ luật từ `release_rule_code`, phiên bản luật từ hợp đồng.

| Cột | Kiểu | Bắt buộc | Mặc định | Khóa | Ý nghĩa |
| --- | --- | --- | --- | --- | --- |
| `version` | integer | ✓ | 1 |  | Số phiên bản, tăng mỗi lần sửa (khóa lạc quan). |
| `created_at` | timestamptz | ✓ | now() |  | Thời điểm tạo dòng. |
| `updated_at` | timestamptz | ✓ | now() |  | Thời điểm sửa gần nhất. |
| `milestone_id` | text | ✓ |  | PK | Mã mốc, ví dụ MS0002. |
| `contract_id` | text | ✓ |  | FK → `contracts(contract_id)` | Hợp đồng chứa mốc (khóa ngoại tới contracts). |
| `milestone_sequence` | integer | ✓ |  |  | Thứ tự mốc trong hợp đồng (1, 2, 3...). |
| `milestone_name` | text | ✓ |  |  | Tên hiển thị của mốc. |
| `due_date` | date | ✓ |  |  | Hạn hoàn thành mốc. |
| `planned_payment_vnd_mn` | numeric(18,2) | ✓ |  |  | Số tiền dự kiến trả (triệu VND). |
| `required_event_types` | text[] | ✓ |  |  | Sự kiện bắt buộc, ví dụ {DELIVERY, INVOICE}. |
| `invoice_required` | boolean | ✓ | false |  | Mốc có cần hóa đơn không. |
| `late_penalty_applicable` | boolean | ✓ | false |  | Mốc có tính phạt trễ không. |
| `release_rule_code` | text | ✓ |  | FK → `rule_scopes(release_rule_code)` | Bộ luật chấm mốc này (khóa ngoại tới rule_scopes); chép từ mốc mẫu khi tạo hợp đồng. |

**Ràng buộc**

- `milestones_amount_check`: `((planned_payment_vnd_mn >= (0)::numeric))`
- `milestones_contract_sequence_key`: không trùng (contract_id, milestone_sequence)
- `milestones_sequence_check`: `((milestone_sequence >= 1))`

## 4. View cho engine

Engine đọc đúng các cột của Data Pack. 4 view dựng lại các cột không lưu; API xuất dữ liệu cho engine bằng các view này.

| View | Dựng lại |
| --- | --- |
| `contract_type_labels` | `rule_set_id` = phần trước `:` của mã bộ luật; `workflow_template` = `WF_` + từ giữa của `rule_set_id` + số bộ luật + `STAGE` (`R_GOODS_STD`, 4 bộ → `WF_GOODS_4STAGE`) |
| `engine_parties` | `country` = `VN`, `data_is_synthetic` = `TRUE` |
| `engine_contracts` | `workflow_template`, `rule_set_id` (từ `contract_type_labels`); `approval_quorum`, `auto_release_allowed` (từ `approval_policy`); `currency`, `initial_contract_status`, `data_is_synthetic` |
| `engine_milestones` | `milestone_type` (từ bộ luật), `payment_percent` (tiền ÷ giá trị), `approval_required`, `required_approval_quorum`, `required_approval_roles` (từ chính sách của hợp đồng), `grace_period_days`, `penalty_rate_pct_per_day`, `max_penalty_pct` (từ hợp đồng, bằng 0 nếu mốc không phạt trễ), `required_condition` (ghép lại), các hằng số |
| `engine_payment_rules` | `rule_set_id`, `workflow_template`, `contract_type`, `applies_to_milestone_type` (từ bộ luật), `evaluation_order`, `stop_processing`, `parameter_source`, `data_is_synthetic` |

Hàm `approval_roles(policy)` trả về vai trò cần duyệt theo chính sách: tự động → không ai; 1 người → `CONTRACT_OWNER`; 2 người → `CONTRACT_OWNER`, `SECONDARY_APPROVER`; tài chính + chủ hợp đồng → `CONTRACT_OWNER`, `FINANCE_APPROVER`.

**Đã kiểm chứng:** nạp toàn bộ Data Pack (65 bên, 100 hợp đồng, 405 mốc, 128 luật) vào các bảng rồi so từng ô của view với file CSV gốc: **14.850 ô, không lệch ô nào**.

## 5. Trigger

| Trigger | Bảng | Chặn |
| --- | --- | --- |
| `rule_versions_status_guard` | `rule_versions` | Đổi trạng thái khác DRAFT → PUBLISHED → RETIRED |
| `payment_rules_version_frozen` | `payment_rules` | Thêm, sửa, xóa luật của phiên bản đã công bố |

Lỗi do trigger trả về API là **409** kèm mã lỗi (`RULE_VERSION_IS_FROZEN`, `RULE_VERSION_STATUS`).

## 6. Migration

| Migration | Nội dung |
| --- | --- |
| `ContractTypesAndRuleScopes` | `contract_types`, `rule_scopes` |
| `StagesRulesContractsMilestones` | `contract_type_stages`, `rule_versions`, `payment_rules`, `parties`, `contracts`, `milestones`, các trigger |
| `DropRecomputableColumns` | Bỏ 30 cột suy ra được; thêm `approval_roles()` và 4 view `engine_*` |
| `DropLabelColumns` | Bỏ `contract_types.workflow_template`, `rule_set_id`, `contracts.amended_end_date`; thêm `contract_type_labels` |
| `DropOrigin` | Bỏ cột `origin` ở mọi bảng và trigger khóa dữ liệu Data Pack |

## 7. Lệnh thường dùng

Chạy trong `apps/api`, Postgres đang chạy (`pnpm db:up` ở thư mục gốc).

| Việc | Lệnh |
| --- | --- |
| Sinh migration từ thay đổi trong model | `pnpm db:generate migrations/TenThayDoi` |
| Áp dụng migration | `pnpm db:migrate` |
| Hoàn tác migration gần nhất | `pnpm db:revert` |
| Xem migration đã áp dụng | `pnpm typeorm migration:show` |
| Xem database trên web | Adminer http://127.0.0.1:8080 (PostgreSQL, server `postgres`, user `dev`, mật khẩu `dev`, database `contract_smart`) |

## 8. Chưa có

`events` (sự kiện), `exception_requests` (hủy sự kiện sai), `engine_runs`, `milestone_evaluations`, `milestone_status_history` (kết quả chấm), `payments`, `milestone_notes`, `organizations`, `users`, `audit_log`; script seed nạp Data Pack.
