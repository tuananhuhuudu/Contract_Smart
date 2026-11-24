# Luồng nghiệp vụ Contract Smart (end-to-end)

> Tài liệu này trả lời ba câu hỏi:
> 1. Hệ thống giải quyết **bài toán gì**?
> 2. **Ai** tham gia, mỗi người làm gì?
> 3. Một hợp đồng đi **từ lúc soạn tới lúc kết thúc** như thế nào, hệ thống xử lý gì ở từng bước?
>
> Chi tiết từng bảng dữ liệu xem [CSDL.md](CSDL.md).

**Cách đọc ký hiệu trạng thái:**

| Ký hiệu | Nghĩa |
| --- | --- |
| ✅ | **Đã làm**, chạy được trên giao diện thử `http://127.0.0.1:3001/test/app.html` |
| 🟡 | **Làm một phần**, phần còn thiếu ghi rõ ngay bên dưới |
| ⏳ | **Chưa làm**; đã có thiết kế (dự án CodeCash trước đã làm thử) |

---

## Mục lục

0. [Đọc nhanh trong 1 phút](#0-đọc-nhanh-trong-1-phút)
1. [Từ điển thuật ngữ](#1-từ-điển-thuật-ngữ)
2. [Bài toán](#2-bài-toán)
3. [Các bên tham gia và phân quyền](#3-các-bên-tham-gia-và-phân-quyền)
4. [Toàn cảnh luồng nghiệp vụ](#4-toàn-cảnh-luồng-nghiệp-vụ)
5. [Chi tiết từng giai đoạn](#5-chi-tiết-từng-giai-đoạn)
6. [Engine chấm hoạt động thế nào](#6-engine-chấm-hoạt-động-thế-nào)
7. [Trạng thái của hợp đồng và mốc](#7-trạng-thái-của-hợp-đồng-và-mốc)
8. [Ví dụ chạy thật: hợp đồng CT0019](#8-ví-dụ-chạy-thật-hợp-đồng-ct0019)
9. [Nguyên tắc an toàn](#9-nguyên-tắc-an-toàn)
10. [Kiến trúc và dữ liệu](#10-kiến-trúc-và-dữ-liệu)
11. [Hiện trạng và lộ trình](#11-hiện-trạng-và-lộ-trình)
12. [Câu hỏi thường gặp](#12-câu-hỏi-thường-gặp)
13. [Phụ lục: danh mục có sẵn](#13-phụ-lục-danh-mục-có-sẵn)

---

## 0. Đọc nhanh trong 1 phút

- **Vấn đề:** hợp đồng trả tiền theo nhiều đợt (mốc). Muốn trả một đợt phải kiểm: đủ giấy tờ chưa, đủ người duyệt chưa, có đang khiếu nại không, có trễ hạn không. Ngày nay việc này làm bằng tay nên chậm, dễ sai, khó giải thích.
- **Giải pháp:** điều kiện trả tiền được viết thành **luật** ngay trên web. Các bên **ghi sự kiện** (đã giao hàng, đã nghiệm thu, đã duyệt...) lên hệ thống. Sau mỗi sự kiện, **engine tự chấm** mốc: trả, giữ, từ chối hay trả có trừ phạt; bao nhiêu tiền; **vì sao**.
- **Người tham gia:** quản trị dựng quy trình; bên mua soạn hợp đồng, xác nhận, phê duyệt và chi tiền; nhà cung cấp nộp chứng từ.
- **Luồng:** dựng quy trình → soạn hợp đồng → ký → ghi sự kiện → engine chấm → (ngoại lệ) → chi tiền → thanh lý.
- **Đã chạy được:** từ dựng quy trình tới engine chấm, giải thích và chi tiền (cổng thanh toán mô phỏng). **Chưa làm:** ký hai bên, ngoại lệ, phụ lục, thanh lý, nhật ký kiểm toán.

---

## 1. Từ điển thuật ngữ

| Thuật ngữ | Nghĩa | Ví dụ |
| --- | --- | --- |
| **Mốc thanh toán** (mốc) | Một đợt trả tiền của hợp đồng, kèm điều kiện để được trả | Mốc "Giao hàng" trả 40% khi đã giao hàng và có hóa đơn |
| **Sự kiện** | Một việc đã xảy ra, được một bên ghi lên hệ thống | "Phú Minh đã giao hàng, biên bản DLV-001" |
| **Chứng từ** | Loại sự kiện chứng minh một việc đã làm xong | Giao hàng, Hóa đơn, Nghiệm thu |
| **Sự kiện bắt buộc** | Các chứng từ một mốc phải có đủ mới được trả | Mốc Giao hàng cần: Giao hàng + Hóa đơn |
| **Phê duyệt** | Người có thẩm quyền của bên mua đồng ý trả mốc | Chủ hợp đồng bấm "Phê duyệt" |
| **Tranh chấp** | Một bên khiếu nại về mốc; khi còn mở thì mốc bị giữ tiền | "Hàng giao bị lỗi" |
| **Luật** | Câu "Nếu ... thì ..." quyết định trả hay giữ tiền | "Nếu đang tranh chấp thì giữ tiền" |
| **Bộ luật** | Danh sách luật của một mốc, xếp theo thứ tự ưu tiên | 8 luật, số 10 tới 80 |
| **Thư viện mốc** | Kho các mốc mẫu do quản trị tạo, dùng lại cho nhiều hợp đồng | Ký hợp đồng, Giao hàng, Nghiệm thu, Hết bảo hành |
| **Phiên bản** | Một lần chốt nội dung của mốc mẫu (sự kiện bắt buộc + bộ luật) | "Giao hàng v1", "Giao hàng v2" |
| **Công bố** | Chốt phiên bản để hợp đồng dùng được; đã công bố thì bị khóa | |
| **Loại hợp đồng** | Khuôn gồm các mốc, mỗi mốc bao nhiêu %, hạn sau bao nhiêu ngày | "Cung cấp hàng hóa" = 20% + 40% + 30% + 10% |
| **Luật riêng** | Bản sao bộ luật chung, sửa riêng cho một hợp đồng | Khách quen được trễ 15 ngày mới phạt |
| **Kích hoạt** | Hợp đồng bắt đầu có hiệu lực, nội dung bị khóa | Bấm "Ký / kích hoạt" |
| **Engine** | Chương trình tự chấm mốc dựa trên sự kiện và bộ luật | |
| **Ân hạn** | Số ngày được trễ mà không bị phạt | Hạn 04/01, ân hạn 3 ngày → tới 07/01 mới tính trễ |
| **Trần phạt** | Mức phạt tối đa, tính theo % tiền mốc | Trần 5% của mốc 300 triệu = tối đa 15 triệu |
| **Sai thẩm quyền** | Sự kiện do một bên không được phép ghi loại đó | Nhà cung cấp tự ghi "Nghiệm thu" |
| **Ngoại lệ** | Quy trình gỡ hậu quả của một sự kiện ghi nhầm, cần hai người | ⏳ |
| **Lệnh chi** | Yêu cầu chuyển tiền cho một mốc đã đủ điều kiện | ⏳ |
| **Thanh lý** | Hai bên xác nhận kết thúc hợp đồng với số liệu chốt | ⏳ |

---

## 2. Bài toán

### 2.1. Một hợp đồng điển hình

Công ty **Nova An** (bên mua) ký hợp đồng mua vật tư của công ty **Phú Minh** (nhà cung cấp), giá trị **1.970 triệu đồng**. Tiền không trả một lần mà chia 4 mốc:

| Mốc | Tỷ lệ | Số tiền | Hạn | Điều kiện để được trả |
| --- | --- | --- | --- | --- |
| 1. Ký hợp đồng | 20% | 394 tr | 07/07 | Hai bên đã ký; bên mua duyệt |
| 2. Giao hàng | 40% | 788 tr | 02/08 | Có biên bản giao hàng và hóa đơn; bên mua duyệt |
| 3. Nghiệm thu | 30% | 591 tr | 14/08 | Bên mua nghiệm thu; không có khiếu nại; bên mua duyệt |
| 4. Hết bảo hành | 10% | 197 tr | 03/09 | Hết thời gian bảo hành; bên mua duyệt |

Hợp đồng còn quy định: được trễ 3 ngày; trễ hơn thì phạt 0,15% mỗi ngày, tối đa 5% tiền mốc; mỗi mốc cần **hai người** của bên mua duyệt.

### 2.2. Ngày nay làm thế nào và gặp vấn đề gì

Đến hạn mỗi mốc, kế toán bên mua phải tự kiểm: biên bản giao hàng ở email nào, hóa đơn đã nhận chưa, hai người đã ký duyệt chưa, phòng kỹ thuật có đang khiếu nại không, giao trễ mấy ngày, phạt bao nhiêu.

| Vấn đề | Hậu quả |
| --- | --- |
| **Chậm**: giấy tờ nằm rải rác ở email, giấy, tin nhắn | Nhà cung cấp chờ tiền lâu, quan hệ hai bên căng thẳng |
| **Dễ sai**: quên kiểm một điều kiện | Trả tiền khi hàng đang bị khiếu nại; quên trừ phạt trễ; người không có thẩm quyền vẫn duyệt |
| **Khó giải thích**: không ghi lại vì sao trả | Kiểm toán hỏi "vì sao khoản này được trả đủ dù giao trễ?" thì không ai trả lời được |
| **Dễ bị sửa**: hồ sơ sửa được sau khi đã chi | Không chứng minh được hồ sơ lúc duyệt trông như thế nào |

### 2.3. Contract Smart giải quyết thế nào

| Vấn đề | Cách giải quyết |
| --- | --- |
| Điều kiện nằm trong văn bản, mỗi người hiểu một kiểu | **Số hóa điều kiện thành luật** dạng câu "Nếu ... thì ...", ai đọc cũng hiểu như nhau |
| Giấy tờ rải rác | Mọi bên **ghi sự kiện lên một chỗ**: hệ thống, kèm số giấy tờ |
| Kiểm bằng tay, dễ sót | **Engine tự chấm** mỗi khi có sự kiện mới, không bỏ sót điều kiện nào |
| Không giải thích được | Mỗi kết quả kèm **lời giải thích**: con số nào, luật nào khớp, vì sao |
| Hồ sơ bị sửa sau khi chi | Sự kiện và kết quả **chỉ được thêm, không sửa, không xóa**; dữ liệu đã chốt bị khóa trong DB |
| Người không có thẩm quyền vẫn duyệt | Quyền lấy từ tài khoản; engine chỉ đếm **đúng người, đúng vai** |

### 2.4. Điểm khác so với dự án CodeCash trước

| | CodeCash (dự án trước) | Contract Smart (dự án này) |
| --- | --- | --- |
| Quy trình | Cố định theo file dữ liệu của ban tổ chức: 4 loại mốc, 128 luật | **Dựng trên web**: tự tạo mốc, tự viết luật, tự ghép loại hợp đồng |
| Luật | Viết dạng công thức | Chọn **câu mẫu tiếng Việt**, chỉ sửa con số |
| Khách hàng đặc biệt | Khó chỉnh | **Luật riêng** cho từng hợp đồng, không ảnh hưởng luật chung |
| Cơ sở dữ liệu | Một file JSON (hoặc MongoDB); ràng buộc kiểm bằng code | **PostgreSQL**: khóa ngoại, ràng buộc và trigger khóa dữ liệu ngay trong DB |

---

## 3. Các bên tham gia và phân quyền

### 3.1. Ba nhóm người dùng

```
┌─ NỀN TẢNG: người vận hành hệ thống, không thuộc công ty nào ──────────┐
│  Quản trị hệ thống      dựng quy trình: loại sự kiện, mốc, luật,        │
│                         loại hợp đồng; quản lý tài khoản                │
│  Kiểm toán              chỉ xem; xem được mọi hợp đồng                  │
└────────────────────────────────────────────────────────────────────────┘
┌─ BÊN MUA: người trả tiền (ví dụ Nova An) ──────────────────────────────┐
│  Pháp lý                soạn hợp đồng; ghi chứng từ của bên mua         │
│  Chủ hợp đồng           soạn hợp đồng; ký / kích hoạt; phê duyệt        │
│  Duyệt tài chính        phê duyệt; duyệt lệnh chi                       │
│  Duyệt thứ hai          phê duyệt                                       │
│  Kiểm soát viên         duyệt ngoại lệ                                  │
└────────────────────────────────────────────────────────────────────────┘
┌─ BÊN BÁN: người nhận tiền (ví dụ Phú Minh) ────────────────────────────┐
│  Nhà cung cấp           ghi chứng từ của mình: giao hàng, hóa đơn...     │
│  Kiểm soát viên         theo dõi bên mua chi đúng hợp đồng              │
└────────────────────────────────────────────────────────────────────────┘
```

### 3.2. Từng vai làm gì

| Vai | Ngoài đời tương ứng | Được làm | Không được làm |
| --- | --- | --- | --- |
| **Quản trị hệ thống** | Bộ phận IT / vận hành nền tảng | Tạo loại sự kiện, mốc mẫu, luật, loại hợp đồng; công bố phiên bản; quản lý tài khoản ⏳ | Tạo hợp đồng, ghi sự kiện, duyệt chi, xử lý ngoại lệ |
| **Kiểm toán** | Kiểm toán nội bộ / độc lập | Xem mọi hợp đồng, sự kiện, kết quả chấm | Mọi thao tác ghi |
| **Pháp lý** (bên mua) | Phòng pháp chế | Tạo và sửa hợp đồng nháp; dùng luật riêng; ghi chứng từ phía bên mua (ký hợp đồng, nghiệm thu) | Ký / kích hoạt; phê duyệt |
| **Chủ hợp đồng** (bên mua) | Trưởng bộ phận phụ trách hợp đồng | Như pháp lý, thêm **ký / kích hoạt** và **phê duyệt** | Tự duyệt ngoại lệ do mình đề xuất ⏳ |
| **Duyệt tài chính** (bên mua) | Kế toán trưởng / giám đốc tài chính | Phê duyệt (khi hợp đồng yêu cầu); **duyệt lệnh chi** | Sửa hợp đồng |
| **Duyệt thứ hai** (bên mua) | Lãnh đạo cấp trên | Phê duyệt (khi hợp đồng yêu cầu) | Sửa hợp đồng |
| **Kiểm soát viên** (bên mua) | Kiểm soát nội bộ | Duyệt hoặc trả lại đề xuất ngoại lệ ⏳ | Tạo sự kiện nghiệp vụ, sửa luật |
| **Nhà cung cấp** | Phòng kinh doanh bên bán | Ghi chứng từ phía mình (giao hàng, hóa đơn, hết bảo hành); xem hợp đồng của mình | Sửa hợp đồng; phê duyệt |
| **Kiểm soát viên** (bên bán) | Kiểm soát nội bộ bên bán | Theo dõi hợp đồng của công ty mình | Thao tác ghi |

**Vì sao bên mua có nhiều người hơn?** Bên mua là bên **chi tiền**, nên cần nhiều lớp kiểm để không chi sai: một người xác nhận chứng từ, một hoặc hai người khác phê duyệt, một người kiểm soát xử lý trường hợp bất thường. Bên bán chỉ cần nộp đủ chứng từ để được trả.

### 3.3. Tài khoản dùng thử

Mật khẩu chung `Passw0rd!`. Trên giao diện thử có nút đăng nhập nhanh và ô **Đổi vai** ở góc trên bên phải.

| Nút đăng nhập nhanh | Vai | Thuộc |
| --- | --- | --- |
| Quản trị hệ thống | Quản trị hệ thống | Nền tảng |
| Kiểm toán (chỉ xem) | Kiểm toán | Nền tảng |
| Nova An: pháp lý | Pháp lý | Nova An (bên mua) |
| Nova An: chủ hợp đồng | Chủ hợp đồng | Nova An |
| Nova An: duyệt tài chính | Duyệt tài chính | Nova An |
| Nova An: duyệt thứ hai | Duyệt thứ hai | Nova An |
| Nova An: kiểm soát | Kiểm soát viên | Nova An |
| Phú Minh: nhà cung cấp | Nhà cung cấp | Phú Minh (bên bán) |
| Phú Minh: kiểm soát | Kiểm soát viên | Phú Minh |

### 3.4. Hai tầng kiểm quyền

Hệ thống kiểm quyền ở **hai nơi**, mỗi nơi một việc:

| | Tầng 1: API | Tầng 2: Engine |
| --- | --- | --- |
| **Trả lời câu hỏi** | Người này có được **bấm nút** này không? | Sự kiện này có được **tính** không? |
| **Dựa vào** | Vai trò và công ty của tài khoản đăng nhập | Danh sách loại sự kiện mỗi bên được ghi; vai trò hợp đồng yêu cầu duyệt |
| **Khi sai thì** | Từ chối ngay (lỗi 403), không lưu gì | Vẫn lưu sự kiện, nhưng engine **đánh dấu sai** và giữ tiền |
| **Ví dụ** | Nhà cung cấp bấm "Tạo hợp đồng" → bị từ chối. Người Phú Minh mở hợp đồng của công ty khác → bị từ chối | Nhà cung cấp tự ghi "Nghiệm thu" → lưu được, nhưng engine coi là sai thẩm quyền và giữ tiền |

**Vì sao tầng 2 không chặn luôn?** Vì ghi lại hành vi sai cũng là bằng chứng. Sau này kiểm toán thấy được ai đã cố ghi sai, lúc nào.

**Quan trọng:** người dùng **không tự khai** mình là ai. Bên ghi sự kiện, công ty, vai trò đều lấy từ tài khoản đăng nhập; mỗi lần gọi API hệ thống đọc lại tài khoản từ DB, nên khóa tài khoản hay đổi vai có hiệu lực ngay.

### 3.5. Kiểu phê duyệt của hợp đồng

Mỗi hợp đồng chọn một kiểu phê duyệt, áp cho mọi mốc của nó:

| Kiểu | Tên trong hệ thống | Cần ai duyệt | Dùng khi |
| --- | --- | --- | --- |
| Tự động | `AUTO_IF_ALL_CONDITIONS` | Không ai, đủ chứng từ là trả | Hợp đồng nhỏ, đối tác tin cậy |
| Một người | `SINGLE_BUYER_APPROVAL` | Chủ hợp đồng | Hợp đồng vừa |
| Hai người | `DUAL_APPROVAL` | Chủ hợp đồng **và** duyệt thứ hai | Hợp đồng lớn |
| Tài chính + chủ | `FINANCE_PLUS_OWNER` | Chủ hợp đồng **và** duyệt tài chính | Hợp đồng cần kế toán kiểm |

Engine chỉ đếm phê duyệt của **đúng vai** được yêu cầu. Ví dụ hợp đồng "Hai người": nếu chủ hợp đồng và duyệt tài chính cùng duyệt thì vẫn chỉ tính **1/2**, vì thiếu duyệt thứ hai.

### 3.6. Tách nhiệm

Không để một người nắm quá nhiều quyền, tránh gian lận:

| Quy tắc | Ý nghĩa | Trạng thái |
| --- | --- | --- |
| Người **cấu hình** không xử lý nghiệp vụ | Quản trị dựng luật nhưng không tạo hợp đồng, không duyệt chi, không duyệt ngoại lệ | ✅ |
| Người **đề xuất** ngoại lệ không tự duyệt | Chủ hợp đồng đề xuất, kiểm soát viên duyệt | ⏳ |
| **Không ai sửa trực tiếp** kết quả | Muốn thay đổi kết quả phải ghi sự kiện mới hoặc đi qua ngoại lệ | ✅ (khóa bằng trigger) |

---

## 4. Toàn cảnh luồng nghiệp vụ

### 4.1. Sơ đồ

```
  GIAI ĐOẠN CHUẨN BỊ (làm một lần, dùng cho nhiều hợp đồng)
  ┌──────────────────────────────────────────────────────────────────┐
  │ 0. DỰNG QUY TRÌNH  (quản trị)                                     │
  │    loại sự kiện → mốc mẫu + luật → công bố → loại hợp đồng        │
  └───────────────────────────────┬──────────────────────────────────┘
                                  │ dùng khuôn
  GIAI ĐOẠN CỦA MỖI HỢP ĐỒNG      ▼
  ┌──────────────────┐   ┌──────────────────┐   ┌──────────────────────┐
  │ 1. SOẠN HỢP ĐỒNG │──▶│ 2. KÝ            │──▶│ 3. THỰC HIỆN         │
  │ pháp lý / chủ HĐ │   │ hai bên ký       │   │ các bên ghi sự kiện  │◀─┐
  └──────────────────┘   └──────────────────┘   └──────────┬───────────┘  │
                                                           │ mỗi sự kiện  │
                                                           ▼              │
                         ┌──────────────────┐   ┌──────────────────────┐  │
                         │ 5. NGOẠI LỆ      │◀──│ 4. ENGINE CHẤM       │  │
                         │ (nếu ghi nhầm)   │   │ tự động              │──┘
                         └────────┬─────────┘   └──────────┬───────────┘ chưa đủ:
                                  │ chấm lại               │ đủ điều kiện  chờ thêm
                                  └───────────▶────────────▼               sự kiện
                                              ┌──────────────────────┐
                                              │ 6. CHI TIỀN          │
                                              │ duyệt tài chính      │
                                              └──────────┬───────────┘
                                                         │ mọi mốc xong
                                                         ▼
                                              ┌──────────────────────┐
                                              │ 7. THANH LÝ          │
                                              │ (phụ lục nếu dời hạn)│
                                              └──────────────────────┘

  XUYÊN SUỐT: nhật ký kiểm toán · việc cần làm / thông báo · tổng quan
```

### 4.2. Tóm tắt các giai đoạn

| # | Giai đoạn | Ai làm | Một câu | Trạng thái |
| --- | --- | --- | --- | --- |
| 0 | Dựng quy trình | Quản trị | Tạo các mốc mẫu kèm luật, ghép thành loại hợp đồng | ✅ |
| 1 | Soạn hợp đồng | Pháp lý, chủ hợp đồng | Tạo hợp đồng từ loại có sẵn, chỉnh cho khách cụ thể | ✅ |
| 2 | Ký | Hai bên | Hai bên ký, hợp đồng có hiệu lực và bị khóa | 🟡 |
| 3 | Thực hiện | Các bên | Ghi giao hàng, hóa đơn, nghiệm thu, phê duyệt, tranh chấp | ✅ |
| 4 | Engine chấm | Tự động | Sau mỗi sự kiện, chấm lại mốc và giải thích | ✅ |
| 5 | Ngoại lệ | Chủ hợp đồng + kiểm soát viên | Gỡ hậu quả sự kiện ghi nhầm, hai người duyệt | ⏳ |
| 6 | Chi tiền | Duyệt tài chính | Mốc đủ điều kiện → lệnh chi → duyệt → chuyển tiền | ✅ |
| 7 | Phụ lục / Thanh lý | Hai bên | Dời hạn bằng phụ lục; xong hết thì chốt thanh lý | ⏳ |

### 4.3. Câu chuyện từ đầu đến cuối

1. **Quản trị** tạo 4 mốc mẫu: Ký hợp đồng, Giao hàng, Nghiệm thu, Hết bảo hành. Mỗi mốc có danh sách chứng từ bắt buộc và 8 luật. Quản trị công bố các mốc, rồi ghép thành loại hợp đồng "Cung cấp hàng hóa" (20% / 40% / 30% / 10%).
2. **Pháp lý Nova An** tạo hợp đồng mới từ loại "Cung cấp hàng hóa" với Phú Minh, giá trị 1.000 triệu. Hệ thống tự sinh 4 mốc: 200 / 400 / 300 / 100 triệu, hạn tính từ ngày bắt đầu. Phú Minh là khách quen nên pháp lý cho mốc Nghiệm thu **dùng luật riêng**, nới điều kiện phạt.
3. **Chủ hợp đồng Nova An** bấm **Ký / kích hoạt**. Hợp đồng bị khóa. Engine chấm lần đầu: cả 4 mốc "giữ tiền – thiếu chứng từ".
4. **Phú Minh** giao hàng, ghi sự kiện "Giao hàng" rồi "Hóa đơn". Engine chấm lại mốc Giao hàng: "giữ tiền – chưa đủ người duyệt".
5. **Chủ hợp đồng** và **duyệt thứ hai** của Nova An lần lượt phê duyệt. Engine chấm lại: **"trả 400 triệu"**.
6. Hệ thống tự lập **lệnh chi** 400 triệu; **duyệt tài chính** duyệt; tiền được chuyển; mốc thành "đã chi".
7. Ở mốc Nghiệm thu, phòng kỹ thuật Nova An phát hiện lỗi và **mở tranh chấp**. Engine giữ tiền. Hai bên thống nhất xong, Nova An **đóng tranh chấp**; engine chấm lại và cho trả.
8. ⏳ Khi cả 4 mốc đã chi, Nova An lập **biên bản thanh lý**, Phú Minh xác nhận. Hợp đồng kết thúc.

---

## 5. Chi tiết từng giai đoạn

Mỗi giai đoạn trình bày theo cùng một khuôn: **mục đích → ai làm → làm ở đâu → các bước → hệ thống kiểm gì → kết quả và dữ liệu lưu → còn thiếu**.

### 5.0. Dựng quy trình ✅

**Mục đích:** chuẩn bị sẵn các "khối lắp ghép" (mốc mẫu, luật, loại hợp đồng) để người soạn hợp đồng không phải tự nghĩ điều kiện mỗi lần.

**Ai làm:** quản trị hệ thống.

**Làm ở đâu:** tab **1. Thư viện mốc** và tab **2. Loại hợp đồng**.

#### Bước 1: Loại sự kiện

Danh sách những việc có thể xảy ra trong hợp đồng. Có sẵn **16 loại** (xem [phụ lục 13.1](#131-16-loại-sự-kiện-có-sẵn)); quản trị thêm được loại mới. Mỗi loại có:

| Thuộc tính | Nghĩa | Ví dụ |
| --- | --- | --- |
| Tên | Tên hiển thị | "Giao hàng" |
| Nhóm | Chứng từ / phê duyệt / từ chối / mở tranh chấp / đóng tranh chấp / khác | Chứng từ |
| Bên được ghi | Với chứng từ: bên mua hay nhà cung cấp | Nhà cung cấp |
| Trạng thái hợp lệ | Máy tự điền khi ghi, người dùng không chọn | `CONFIRMED` |

#### Bước 2: Tạo mốc mẫu trong thư viện

Ví dụ tạo mốc **"Giao hàng"**. Có thể bắt đầu trống hoặc **sao chép từ một mốc có sẵn** (chép cả sự kiện bắt buộc và luật). Mốc mới có sẵn **bản nháp v1**.

Trong mỗi phiên bản, quản trị chọn:

| Mục | Nghĩa | Ví dụ |
| --- | --- | --- |
| Sự kiện bắt buộc | Chứng từ phải có đủ | Giao hàng + Hóa đơn |
| Có phạt trễ | Mốc này trễ hạn có bị phạt không | Có |
| Ghi chú | Mô tả cho người đọc | |
| Bộ luật | Danh sách luật (bước 3) | 8 luật |

#### Bước 3: Viết luật bằng câu mẫu

Người dùng **không phải gõ công thức**. Màn hình có **10 câu mẫu**, chỉ cần chọn câu và (nếu có) sửa con số:

| Ưu tiên | Câu mẫu | Thì | Lý do |
| --- | --- | --- | --- |
| 10 | Đang có tranh chấp thì giữ tiền | Giữ tiền | Đang tranh chấp |
| 20 | Bên mua từ chối thì không trả | Từ chối | Bên mua từ chối |
| 30 | Chứng từ do bên không có quyền ghi thì giữ tiền | Giữ tiền | Sai thẩm quyền |
| 40 | Thiếu chứng từ bắt buộc thì giữ tiền | Giữ tiền | Thiếu chứng từ |
| 50 | Mốc cần duyệt mà chưa đủ người duyệt (theo chính sách hợp đồng) thì giữ tiền | Giữ tiền | Chưa đủ người duyệt |
| 52 | Chưa đủ **{n}** người duyệt thì giữ tiền | Giữ tiền | Chưa đủ người duyệt |
| 55 | Trễ quá **{n}** ngày (sau ân hạn) thì từ chối | Từ chối | Trễ hạn |
| 60 | Xong trễ hạn thì trừ tiền phạt (theo % phạt/ngày, có trần) | Trả có trừ phạt | Trễ hạn |
| 70 | Đủ mọi điều kiện thì trả đủ tiền | Trả tiền | Đủ điều kiện |
| 80 | Các trường hợp còn lại thì giữ tiền để kiểm tra | Giữ tiền | Chưa xác định |

**{n}** là con số người dùng tự sửa, ví dụ "Trễ quá **30** ngày thì từ chối".

**Thứ tự rất quan trọng.** Engine thử luật **từ trên xuống, luật đầu tiên khớp sẽ quyết định**. Vì vậy các luật "xấu" (tranh chấp, từ chối, thiếu chứng từ) phải đứng **trước** luật "trả tiền". Luật cuối luôn là "các trường hợp còn lại thì giữ tiền", làm lưới an toàn. Người dùng sắp xếp lại được bằng nút lên / xuống.

**Chế độ "Nâng cao"** cho người rành hơn: sửa điều kiện từng vế bằng ô chọn (chọn con số, phép so sánh, giá trị), và chọn **cách tính tiền**:

| Cách tính tiền | Nghĩa |
| --- | --- |
| Không trả | Trả 0 |
| Trả đủ tiền mốc | Trả 100% tiền mốc |
| Trả sau khi trừ phạt trễ | Tiền mốc − phạt (phạt theo % mỗi ngày của hợp đồng, có trần) |
| Tự nhập | Công thức riêng |

#### Bước 4: Công bố phiên bản

Hệ thống kiểm phiên bản trước khi cho công bố:

- có ít nhất một sự kiện bắt buộc;
- có ít nhất một luật;
- luật cuối cùng là "các trường hợp còn lại";
- mọi điều kiện chỉ dùng các con số engine hiểu được.

Đạt thì phiên bản chuyển `DRAFT → PUBLISHED` và **bị khóa vĩnh viễn** (trigger trong DB chặn sửa). Muốn đổi luật thì **tạo phiên bản mới**; khi phiên bản mới được công bố, phiên bản cũ chuyển `RETIRED`. Hợp đồng đang dùng phiên bản cũ **không bị ảnh hưởng**.

> **Vì sao phải khóa?** Hợp đồng đã ký theo luật nào thì phải chấm đúng theo luật đó. Nếu quản trị sửa luật chung mà hợp đồng cũ bị đổi theo, thì kết quả chấm không còn đúng với điều hai bên đã ký.

#### Bước 5: Ghép thành loại hợp đồng

Tab **2. Loại hợp đồng**. Ví dụ loại **"Cung cấp hàng hóa"**:

| Thứ tự | Mốc | % tiền | Hạn (số ngày sau ngày bắt đầu) |
| --- | --- | --- | --- |
| 1 | Ký hợp đồng | 20% | +3 |
| 2 | Giao hàng | 40% | +29 |
| 3 | Nghiệm thu | 30% | +41 |
| 4 | Hết bảo hành | 10% | +61 |

Hệ thống kiểm: mọi mốc đã công bố; tổng **đúng 100%**. Chưa đủ 100% thì chưa tạo được hợp đồng từ loại này.

**Kết quả và dữ liệu lưu:** `event_types`, `milestone_library`, `milestone_versions`, `payment_rules`, `contract_types`, `contract_type_milestones`.

**Còn thiếu:**

| Việc | Trạng thái |
| --- | --- |
| **Kiểm an toàn bộ luật** trước khi công bố. Ví dụ người dùng đặt luật "Đủ chứng từ thì trả tiền" **trước** luật "Đang tranh chấp thì giữ tiền" → mốc đang tranh chấp vẫn được trả. Hệ thống cần phát hiện và chặn | ⏳ |
| Màn hình **quản lý tài khoản**: tạo, khóa, gán vai trò, gán công ty (hiện tài khoản được nạp sẵn) | ⏳ |

---

### 5.1. Soạn hợp đồng ✅

**Mục đích:** tạo hợp đồng cụ thể với một nhà cung cấp, từ khuôn có sẵn, rồi chỉnh cho phù hợp với khách.

**Ai làm:** pháp lý hoặc chủ hợp đồng **của bên mua**. Bên mua tự động là công ty của người tạo; không tạo hợp đồng thay công ty khác được.

**Làm ở đâu:** tab **3. Hợp đồng & sự kiện**, nút **+ Tạo hợp đồng**.

#### Bước 1: Tạo hợp đồng

| Thông tin nhập | Ví dụ |
| --- | --- |
| Tên hợp đồng | Cung cấp thiết bị mạng |
| Loại hợp đồng | Cung cấp hàng hóa |
| Nhà cung cấp | Phú Minh Technology JSC |
| Giá trị (triệu) | 1.000 |
| Ngày bắt đầu, kết thúc | 24/11/2026 → 23/05/2027 |
| Kiểu phê duyệt | Hai người (`DUAL_APPROVAL`) |
| Số ngày ân hạn | 3 |
| Phạt mỗi ngày (%) | 0,15 |
| Trần phạt (%) | 5 |

#### Bước 2: Hệ thống tự sinh các mốc

| Mốc | Cách tính | Kết quả |
| --- | --- | --- |
| Tiền mỗi mốc | % × giá trị hợp đồng; phần lẻ dồn vào mốc cuối để tổng luôn đúng | 200 / 400 / 300 / 100 triệu |
| Hạn mỗi mốc | Ngày bắt đầu + số ngày của khuôn | 27/11, 23/12, 04/01, 24/01 |
| Luật | Mỗi mốc dùng phiên bản đang công bố của mốc mẫu | "v1 chung" |

#### Bước 3: Chỉnh cho khách cụ thể (khi còn là bản nháp)

| Muốn | Làm thế nào | Hệ thống tự xử lý |
| --- | --- | --- |
| Đổi % hoặc hạn một mốc | Sửa trực tiếp trên bảng mốc | Tính lại tiền mốc đó |
| Đổi giá trị hợp đồng | Sửa giá trị | Chia lại tiền mọi mốc theo tỷ lệ cũ |
| Đổi ngày bắt đầu | Sửa ngày | Dời mọi hạn cùng số ngày |
| Thêm mốc | Chọn mốc từ thư viện, nhập % và hạn | Xếp lại thứ tự |
| Bỏ mốc | Nút "Bỏ" | Xếp lại thứ tự |
| **Luật riêng cho khách** | Nút **"Dùng luật riêng"** ở một mốc | Chép bộ luật chung thành **bản nháp riêng** của hợp đồng này để sửa. Bộ luật chung **không bị ảnh hưởng** |
| Bỏ luật riêng | Nút **"Về luật chung"** | Xóa bản riêng, quay về luật chung |

> **Ví dụ luật riêng:** luật chung phạt ngay khi trễ sau ân hạn. Phú Minh là khách quen, nên pháp lý dùng luật riêng cho mốc Nghiệm thu: thêm luật "Trễ quá 15 ngày thì từ chối" và bỏ phạt. Các hợp đồng khác vẫn theo luật chung.

Tổng tiền các mốc hiện ngay dưới bảng: **xanh** khi bằng giá trị hợp đồng, **đỏ** khi lệch. Lệch thì chưa kích hoạt được.

**Kết quả và dữ liệu lưu:** `contracts` (trạng thái `DRAFT`), `milestones`; luật riêng lưu thành phiên bản riêng trong `milestone_versions` (đánh dấu `is_custom`) và `payment_rules`.

**Còn thiếu:**

| Việc | Trạng thái |
| --- | --- |
| Kiểm **trần phạt ≤ 8%** giá trị phần vi phạm (Luật Thương mại 2005, Điều 301) | ⏳ |
| Tải lên file PDF hợp đồng, **AI đọc và đề xuất** điều khoản (giá trị, mốc, phạt...); người dùng xác nhận, AI không quyết định | ⏳ |

---

### 5.2. Ký hợp đồng 🟡

**Mục đích:** hai bên đồng ý với nội dung; từ lúc này hợp đồng có hiệu lực và **không ai sửa được nữa**.

#### Hiện tại đã làm

**Ai làm:** chủ hợp đồng bên mua. **Làm ở đâu:** nút **"Ký / kích hoạt"** ở đầu trang hợp đồng.

**Hệ thống kiểm:**

| Điều kiện | Nếu sai |
| --- | --- |
| Hợp đồng đang là bản nháp | Báo "chỉ bản nháp mới kích hoạt được" |
| Có ít nhất một mốc | Báo lỗi |
| Tổng tiền các mốc **bằng** giá trị hợp đồng | Báo lỗi |
| Bên mua, nhà cung cấp hợp lệ và đang hoạt động | Báo lỗi |
| Luật riêng (nếu có) đầy đủ: có sự kiện bắt buộc, có luật, luật cuối là "còn lại" | Báo lỗi |

**Kết quả:**

1. Hợp đồng chuyển `DRAFT → ACTIVE`.
2. **Điều khoản, mốc và luật riêng bị khóa** (trigger trong DB), không ai sửa được, kể cả gọi thẳng vào DB.
3. Từ lúc này mới **ghi được sự kiện**.
4. **Engine chấm mọi mốc lần đầu.** Thường ra "giữ tiền – thiếu chứng từ" vì chưa có sự kiện nào.

#### Còn thiếu ⏳

Hiện chỉ bên mua bấm nút, **nhà cung cấp không ký**, và chưa có văn bản hợp đồng. Luồng đầy đủ dự kiến:

```
 Bên mua bấm "Gửi ký"
   │
   ▼
 Hệ thống sinh VĂN BẢN HỢP ĐỒNG (PDF)
 theo thể thức Nghị định 30/2020: quốc hiệu, căn cứ pháp lý, bảng mốc, khối chữ ký
   │
   ▼
 Tính MÃ BĂM SHA-256 của văn bản
 (giống "dấu vân tay": sửa dù một chữ thì mã băm đổi)
   │
   ▼  hợp đồng ở trạng thái "Chờ ký" (AWAITING_SIGNATURE)
 Nhà cung cấp ký ──▶ Bên mua ký        (theo thứ tự đã định)
   │
   ▼  đủ chữ ký
 Hợp đồng ACTIVE + hệ thống TỰ GHI sự kiện "Ký hợp đồng" cho mốc 1
```

| Điểm mới | Lợi ích |
| --- | --- |
| **Cả hai bên** ký | Đúng với thực tế: hợp đồng cần sự đồng ý của hai bên |
| Chữ ký gắn với **mã băm của văn bản** | Ai sửa văn bản sau khi ký, hệ thống phát hiện ngay |
| Trang **kiểm tra chữ ký** | Bất kỳ ai cũng kiểm lại được, kể cả với file PDF tải lên |
| **Tự ghi** sự kiện "Ký hợp đồng" | Không phải ghi tay như hiện nay |

Bản demo dùng chứng thư mô phỏng. **Giá trị pháp lý thật** (Luật Giao dịch điện tử 2023: chữ ký số hợp lệ có giá trị như chữ ký tay) cần ký qua nhà cung cấp dịch vụ chữ ký số được cấp phép.

---

### 5.3. Thực hiện: ghi sự kiện ✅

**Mục đích:** ghi lại mọi việc xảy ra ở từng mốc, làm căn cứ để engine chấm.

**Ai làm:** các bên của hợp đồng. **Làm ở đâu:** trên trang hợp đồng, bấm **"Sự kiện & cách chấm"** ở một mốc → khung **"Ghi sự kiện mới"**.

#### Ai ghi gì

| Ai | Ghi gì | Ví dụ |
| --- | --- | --- |
| Nhà cung cấp | Chứng từ phía nhà cung cấp | Giao hàng `DLV-001`, Hóa đơn `INV-001`, Hết bảo hành |
| Pháp lý bên mua | Chứng từ phía bên mua | Ký hợp đồng, Nghiệm thu |
| Chủ hợp đồng, duyệt tài chính, duyệt thứ hai | Phê duyệt hoặc Từ chối | Phê duyệt mốc Giao hàng |
| Các bên | Mở tranh chấp, đóng tranh chấp | Mở: "hàng giao bị lỗi"; đóng: "đã thống nhất đổi hàng" |

Màn hình **tự gợi ý** loại sự kiện phù hợp: nhà cung cấp thấy sẵn chứng từ còn thiếu của mình; người duyệt thấy sẵn "Phê duyệt".

#### Mỗi sự kiện lưu những gì

| Thông tin | Ai điền |
| --- | --- |
| Mốc, loại sự kiện | Người dùng chọn |
| **Bên ghi** | **Hệ thống**, lấy từ tài khoản đăng nhập |
| **Người bấm** | **Hệ thống** |
| **Trạng thái** | **Hệ thống**, theo loại sự kiện |
| Lúc xảy ra | Người dùng; bỏ trống = bây giờ |
| Số giấy tờ | Người dùng; engine dùng để phát hiện nộp trùng |
| Đóng tranh chấp nào | Người dùng; chỉ với "Đóng tranh chấp" |
| Ghi chú | Người dùng |

#### Hệ thống kiểm gì

| Điều kiện | Nếu sai |
| --- | --- |
| Hợp đồng đang `ACTIVE` | Từ chối: chỉ ghi được khi hợp đồng có hiệu lực |
| Loại sự kiện đang được dùng | Từ chối |
| Người ghi thuộc một bên của hợp đồng | Từ chối (403) |
| Đóng tranh chấp: phải chỉ ra tranh chấp **cùng mốc**, **chưa bị đóng**, và lúc đóng **không sớm hơn** lúc mở | Từ chối |
| Ô "đóng tranh chấp nào" chỉ dùng cho loại "Đóng tranh chấp" | Từ chối |
| Bên ghi **sai loại chứng từ** (ví dụ nhà cung cấp ghi "Nghiệm thu") | **Không chặn**: lưu lại, engine đánh dấu sai thẩm quyền và giữ tiền |

**Sự kiện chỉ được thêm, không sửa, không xóa** (trigger trong DB). Ghi nhầm thì đi qua quy trình ngoại lệ (mục 5.5).

**Kết quả:** sự kiện lưu vào bảng `events`; ngay sau đó **engine tự chấm lại mốc**, và màn hình báo "Đã ghi sự kiện #15. Engine chấm lại: Trả tiền · Đủ mọi điều kiện".

**Còn thiếu:**

| Việc | Trạng thái |
| --- | --- |
| Đính kèm **file chứng từ thật** (PDF, ảnh, Word, Excel); lưu mã băm; người nộp ký lên file; tải về thì kiểm lại mã băm | ⏳ |
| **Kiểm hóa đơn**: số tiền đúng bằng tiền mốc; không trùng số hóa đơn ở bất kỳ hợp đồng nào; ngày lập không trước ngày ký, không sau hôm nay | ⏳ |
| **Hạn mức phê duyệt**: mỗi người duyệt có hạn mức; khoản vượt hạn mức thì lượt duyệt của người đó không được tính | ⏳ |

---

### 5.4. Engine chấm ✅

**Mục đích:** tự động quyết định mỗi mốc được trả bao nhiêu và giải thích vì sao.

**Ai làm:** hệ thống, **tự động**.

| Lúc nào chạy | Chấm mốc nào |
| --- | --- |
| Kích hoạt hợp đồng | Mọi mốc |
| Ghi một sự kiện | Mốc của sự kiện đó |
| Bấm "Chấm lại ngay" | Mốc đó (ít khi cần) |

**Kết quả:** mỗi lần chấm thêm một dòng vào bảng `milestone_evaluations`. Màn hình hiện cột **"Kết quả engine"** và phần **"Cách engine chấm"**.

Cách engine chấm được giải thích kỹ ở [mục 6](#6-engine-chấm-hoạt-động-thế-nào).

**Còn thiếu:**

| Việc | Trạng thái |
| --- | --- |
| **Cảnh báo trình tự**: phê duyệt trước khi có chứng từ; chứng từ trước ngày ký hợp đồng; cùng một người gửi lại cùng loại chứng từ trong 24 giờ. Chỉ cảnh báo để người duyệt chú ý, không đổi quyết định | ⏳ |
| **Điểm tin cậy** của quyết định | ⏳ |
| **Ràng buộc thứ tự giữa các mốc** (ví dụ "mốc trước chưa xong thì giữ tiền"). Hiện mỗi mốc được chấm **độc lập** | ⏳ |

---

### 5.5. Xử lý ngoại lệ ⏳

**Vấn đề:** sự kiện **không xóa được**. Nếu có người ghi nhầm, ví dụ nhà cung cấp lỡ bấm "Nghiệm thu" (việc của bên mua), engine sẽ giữ tiền vì sai thẩm quyền, và mốc **bị kẹt mãi**.

**Vì sao không cho xóa?** Nếu ai cũng xóa được sự kiện thì cũng xóa được bằng chứng bất lợi, ví dụ xóa một tranh chấp để được trả tiền. Vì vậy chỉ cho "vô hiệu" qua **hai người**, và mọi bước đều để lại dấu vết.

**Luồng dự kiến:**

```
 1. Chủ hợp đồng ĐỀ XUẤT: "vô hiệu sự kiện #23, lý do: nhà cung cấp ghi nhầm"
        │
        ▼
 2. Kiểm soát viên CỦA CÙNG BÊN MUA xem xét
        │
        ├── TRẢ LẠI (kèm lý do) ──▶ kết thúc, không đổi gì
        │
        └── DUYỆT
              │
              ▼
 3. Sự kiện #23 VẪN NẰM TRONG DB nhưng được đánh dấu "đã vô hiệu"
    → engine bỏ qua nó → chấm lại mốc → mốc hết bị kẹt
```

| Quy tắc | Lý do |
| --- | --- |
| Người đề xuất **không được tự duyệt** | Tránh một người tự gỡ chặn để trả tiền |
| Sự kiện bị vô hiệu **không bị xóa** | Vẫn xem được ai đã ghi sai, lúc nào |
| Mỗi bước ghi vào nhật ký | Kiểm toán truy vết được |

---

### 5.6. Chi tiền ✅

**Vấn đề:** engine chỉ nói mốc này **"được"** trả 400 triệu. Tiền chưa thực sự đi.

**Ai làm:** hệ thống tự lập lệnh; **duyệt tài chính của bên mua** duyệt. **Làm ở đâu:** cột **"Chi tiền"** trong bảng mốc (nút **Duyệt chi**) và mục **"Lệnh chi"** dưới bảng.

**Luồng:**

```
 Engine kết luận: Trả tiền / Trả có trừ phạt
        │
        ▼
 Hệ thống TỰ LẬP LỆNH CHI: mốc, số tiền, tiền phạt đã trừ, lần chấm làm căn cứ
        │
        ▼
 Người DUYỆT TÀI CHÍNH bên mua bấm "Duyệt chi" (mỗi mốc chỉ một lần)
 → hệ thống kiểm lại: lệnh còn khớp lần chấm mới nhất không
        │
        ▼
 Gửi sang CỔNG THANH TOÁN (bản demo: mô phỏng, luôn nhận, trả mã SIM-...)
        │
        ▼
 Mốc chuyển "ĐÃ CHI" và bị khóa: không ghi thêm sự kiện, engine không chấm lại
```

| Quy tắc | Lý do |
| --- | --- |
| Lệnh chi gắn **lần chấm làm căn cứ** | Biết được đã chi dựa trên kết quả nào |
| Mỗi mốc có tối đa **một** lệnh chưa hủy (index duy nhất trong DB) | Không chi trùng |
| Mốc đã chi bị khóa | Sự kiện ghi sau đó không làm thay đổi khoản đã chi |
| Chỉ **duyệt tài chính của bên mua** được duyệt chi | Tách nhiệm: người duyệt mốc khác người cho chi |

**Các trường hợp:**

| Trường hợp | Hệ thống xử lý |
| --- | --- |
| Engine cho trả, mốc chưa có lệnh | Tự lập lệnh **Chờ duyệt chi** |
| Engine chấm lại vẫn cho trả cùng số tiền | Giữ nguyên lệnh |
| Engine chấm lại **không còn cho trả** (ví dụ vừa mở tranh chấp) hoặc ra số tiền khác | **Hủy** lệnh đang chờ, ghi lý do; khi engine cho trả lại thì lập lệnh mới |
| Người khác vai bấm Duyệt chi | Từ chối (403) |
| Lệnh không còn khớp lần chấm mới nhất | Từ chối (`PAYMENT_STALE`), phải tải lại |
| Mốc đã chi mà có người ghi thêm sự kiện | Từ chối (`MILESTONE_PAID`) |
| Mọi mốc đã chi hoặc bị từ chối | Hợp đồng tự chuyển `CLOSED` |

Lệnh chi lưu ở bảng `payments`; trigger trong DB chặn xóa lệnh và chặn sửa lệnh đã chi hoặc đã hủy. Nối cổng thanh toán thật là thay đúng một hàm (`sendToGateway`).

| Còn thiếu | Trạng thái |
| --- | --- |
| Cổng thanh toán thật (gửi lỗi thì thử lại, chống chi hai lần bằng khóa idempotency) | ⏳ |

---

### 5.7. Phụ lục và thanh lý ⏳

#### Phụ lục: thay đổi sau khi ký

Sau khi ký, điều khoản bị khóa. Nếu cần **dời hạn** (ví dụ nhà cung cấp xin lùi ngày giao vì thiếu hàng):

```
 Bên mua ĐỀ XUẤT phụ lục: mốc Giao hàng dời hạn 23/12 → 10/01, lý do: ...
        │
        ▼
 Nhà cung cấp CHẤP NHẬN ──▶ hạn đổi, engine chấm lại (có thể hết bị phạt trễ)
             hoặc TỪ CHỐI (kèm lý do) ──▶ giữ nguyên
 (bên mua rút lại được khi nhà cung cấp chưa trả lời)
```

- Mốc **đã chi** thì không dời hạn được, vì dời hạn sau khi chi là sửa tiền phạt đã quyết.
- Mỗi hợp đồng chỉ có **một phụ lục đang chờ** tại một thời điểm.

#### Thanh lý: kết thúc hợp đồng

```
 Mọi mốc đã chi hoặc bị từ chối
        │
        ▼
 Bên mua LẬP BIÊN BẢN THANH LÝ với số liệu chốt:
 giá trị hợp đồng, đã chi, tiền phạt, phần bị từ chối (kèm mã băm)
        │
        ▼
 Nhà cung cấp XÁC NHẬN (hoặc từ chối kèm lý do)
        │
        ▼
 Hợp đồng LIQUIDATED: không ghi thêm được gì nữa
```

---

### 5.8. Tính năng xuyên suốt ⏳

| Tính năng | Nội dung | Ví dụ |
| --- | --- | --- |
| **Nhật ký kiểm toán** | Mọi thao tác ghi (tạo hợp đồng, ký, ghi sự kiện, chấm, duyệt chi...) thêm một dòng nhật ký. Mỗi dòng chứa **mã băm của dòng trước** (chuỗi băm), nên sửa hay xóa một dòng giữa chừng là bị phát hiện. Không ai sửa, xóa được | "14:15 – owner@novaan.vn – ghi sự kiện #15 (Đóng tranh chấp) – hợp đồng #1" |
| **Việc cần làm / thông báo** | Mỗi người thấy danh sách việc của mình | Nhà cung cấp: "mốc Giao hàng còn thiếu Hóa đơn". Chủ hợp đồng: "2 mốc chờ bạn duyệt". Tài chính: "1 lệnh chi chờ duyệt" |
| **Tổng quan nhiều hợp đồng** | Dashboard theo công ty | Bao nhiêu mốc đang giữ; đã chi bao nhiêu; mốc nào sắp tới hạn |

---

## 6. Engine chấm hoạt động thế nào

### 6.1. Engine nhận gì, trả gì

```
                 ┌──────────────────────────────────┐
  Hợp đồng ────▶ │                                  │
  Mốc ─────────▶ │                                  │ ──▶ Quyết định (trả / giữ / từ chối / phạt)
  Sự kiện ─────▶ │             ENGINE               │ ──▶ Số tiền trả, tiền phạt
  Bộ luật ─────▶ │                                  │ ──▶ Trạng thái mốc
  Các bên ─────▶ │                                  │ ──▶ Lời giải thích
                 └──────────────────────────────────┘
```

Engine là một chương trình Python riêng. Mỗi lần cần chấm, API đọc dữ liệu từ PostgreSQL, gửi cho engine, nhận kết quả và lưu lại.

### 6.2. Bước 1: đọc sự kiện, tính ra các con số

Engine đi qua các sự kiện của mốc và tính:

| Con số | Nghĩa | Cách tính |
| --- | --- | --- |
| Tỷ lệ đủ chứng từ | Đã có bao nhiêu phần chứng từ bắt buộc | Số chứng từ hợp lệ đã có ÷ số chứng từ bắt buộc (1 = đủ) |
| Có tranh chấp đang mở | Còn tranh chấp chưa đóng không | Có "Mở tranh chấp" mà chưa có "Đóng tranh chấp" trỏ tới |
| Số lần từ chối hợp lệ | Bên mua đã từ chối mốc chưa | Đếm sự kiện "Từ chối" của người có quyền |
| Số chứng từ sai thẩm quyền | Có ai ghi loại chứng từ không phải của mình không | Đếm chứng từ do bên không được phép ghi |
| Số vai trò đã duyệt / cần duyệt | Đủ người duyệt chưa | Đếm vai trò **khác nhau**, **đúng vai** hợp đồng yêu cầu |
| Ngày hoàn thành thực tế | Ngày có đủ chứng từ | Ngày của chứng từ bắt buộc cuối cùng |
| Số ngày trễ sau ân hạn | Trễ bao nhiêu ngày | Ngày hoàn thành − (hạn + ân hạn), không âm |

Trong bước này engine cũng **lọc bỏ**: sự kiện trùng (cùng loại, cùng bên, cùng số giấy tờ); phê duyệt của người không đúng vai; sự kiện không liên quan.

### 6.3. Bước 2: thử luật từ trên xuống

Engine thử từng luật theo thứ tự ưu tiên. **Luật đầu tiên khớp sẽ quyết định**, các luật sau không cần xét.

Ví dụ mốc Nghiệm thu đang có tranh chấp:

| # | Luật | Thực tế | Kết quả thử |
| --- | --- | --- | --- |
| 10 | Đang tranh chấp thì giữ tiền | Tranh chấp đang mở: **Có** | ✓ **khớp → quyết định: giữ tiền** |
| 20 | Bên mua từ chối thì không trả | | — không cần xét |
| ... | ... | | — không cần xét |
| 70 | Đủ mọi điều kiện thì trả tiền | | — không cần xét |

Sau khi đóng tranh chấp, chấm lại:

| # | Luật | Thực tế | Kết quả thử |
| --- | --- | --- | --- |
| 10 | Đang tranh chấp thì giữ tiền | Tranh chấp đang mở: **Không** | ✗ không khớp, xét luật sau |
| 20 | Bên mua từ chối thì không trả | Số lần từ chối: 0 | ✗ |
| 30 | Sai thẩm quyền thì giữ tiền | Số chứng từ sai: 0 | ✗ |
| 40 | Thiếu chứng từ thì giữ tiền | Tỷ lệ đủ: 1 | ✗ |
| 50 | Chưa đủ người duyệt thì giữ tiền | Đã duyệt 2 / cần 2 | ✗ |
| 60 | Xong trễ hạn thì trừ phạt | Xong 12/08, hạn 14/08 + 3 ngày | ✗ |
| 70 | Đủ mọi điều kiện thì trả tiền | Đủ: Có; tranh chấp: Không; từ chối: 0 | ✓ **khớp → trả tiền** |
| 80 | Còn lại thì giữ tiền | | — không cần xét |

### 6.4. Bốn quyết định

| Quyết định | Nghĩa | Tiền trả |
| --- | --- | --- |
| **Trả tiền** (`RELEASE`) | Đủ mọi điều kiện | Đủ tiền mốc |
| **Trả có trừ phạt** (`PENALTY`) | Xong, nhưng trễ hạn | Tiền mốc − tiền phạt |
| **Giữ tiền** (`HOLD`) | Chưa đủ điều kiện hoặc đang có vấn đề | 0, chờ thêm sự kiện |
| **Từ chối** (`REJECT`) | Bên mua từ chối hợp lệ, hoặc trễ quá mức cho phép | 0 |

**Giữ tiền** và **từ chối** khác nhau: giữ là **tạm thời** (có thêm sự kiện là chấm lại, có thể được trả); từ chối là **kết luận** không trả.

### 6.5. Cách tính tiền phạt

```
số ngày trễ  = ngày hoàn thành − (hạn + số ngày ân hạn)        (không âm)
tiền phạt    = tiền mốc × mức phạt mỗi ngày × số ngày trễ
               nhưng không vượt quá  tiền mốc × trần phạt
tiền trả     = tiền mốc − tiền phạt
```

**Ví dụ:** mốc Nghiệm thu 300 triệu, hạn 04/01/2027, ân hạn 3 ngày, phạt 0,15%/ngày, trần 5%. Nghiệm thu ngày 20/01/2027.

| Bước | Tính | Kết quả |
| --- | --- | --- |
| Hạn + ân hạn | 04/01 + 3 ngày | 07/01 |
| Số ngày trễ | 20/01 − 07/01 | 13 ngày |
| Phạt chưa xét trần | 300 × 0,15% × 13 | 5,85 triệu |
| Trần phạt | 300 × 5% | 15 triệu |
| Tiền phạt | 5,85 < 15 nên giữ nguyên | **5,85 triệu** |
| Tiền trả | 300 − 5,85 | **294,15 triệu** |

Mọi phép tính tiền dùng **số thập phân chính xác** (không dùng số thực dấu phẩy động), làm tròn 2 chữ số.

### 6.6. Kết quả được lưu và hiển thị thế nào

**Lưu:** mỗi lần chấm thêm **một dòng** vào bảng `milestone_evaluations`:

| Trường | Ví dụ |
| --- | --- |
| Mốc | Nghiệm thu (#3) |
| Do sự kiện nào | #15 (Đóng tranh chấp); trống nếu chấm lúc kích hoạt |
| Quyết định, lý do | Trả tiền, Đủ mọi điều kiện |
| Luật quyết định | #70 "Đủ mọi điều kiện thì trả tiền" |
| Trạng thái mốc | Đủ điều kiện trả |
| Tiền trả, tiền phạt | 591,00 / 0,00 |
| Giải thích | Toàn bộ con số ở bước 1 và kết quả thử từng luật ở bước 2 |
| Lúc chấm | 24/11/2026 16:14 |

Dòng mới nhất là **kết quả hiện tại**; các dòng cũ là **lịch sử**. Bảng này chỉ được thêm, không sửa, không xóa.

**Hiển thị:** trên trang hợp đồng:

- cột **"Kết quả engine"** ở mỗi mốc: ví dụ "Trả tiền 591 tr – Đủ mọi điều kiện";
- bấm **"Sự kiện & cách chấm"** để xem phần **"Cách engine chấm"**, gồm:
  - **Kết luận**: quyết định, tiền, luật nào quyết định;
  - **Bước 1**: thiếu chứng từ gì, sự kiện sai thẩm quyền, tranh chấp đang mở, số người duyệt, ngày hoàn thành, số ngày trễ;
  - **Bước 2**: bảng thử từng luật, mỗi vế kèm giá trị thực tế, luật khớp được tô xanh;
  - **Lịch sử chấm**: mọi lần chấm trước đó.

### 6.7. Engine lấy từ đâu

Engine lấy từ dự án CodeCash, giữ nguyên logic chấm. Dự án này viết thêm phần **chuyển dữ liệu** từ PostgreSQL sang dạng engine hiểu. Trên hợp đồng mẫu CT0019, engine mới cho **kết quả giống hệt** engine cũ (3 mốc trả, Nghiệm thu giữ vì tranh chấp).

---

## 7. Trạng thái của hợp đồng và mốc

### 7.1. Hợp đồng

```
  DRAFT ──ký──▶ AWAITING_SIGNATURE ⏳ ──đủ chữ ký──▶ ACTIVE ──mọi mốc xong──▶ CLOSED ⏳ ──thanh lý──▶ LIQUIDATED ⏳
 bản nháp        chờ hai bên ký                    đang thực hiện             xong các mốc               đã kết thúc
```

| Trạng thái | Nghĩa | Được làm gì | Trạng thái |
| --- | --- | --- | --- |
| `DRAFT` | Bản nháp | Sửa mọi thứ; kích hoạt | ✅ |
| `AWAITING_SIGNATURE` | Chờ hai bên ký | Ký | ⏳ |
| `ACTIVE` | Đang thực hiện | Ghi sự kiện; engine chấm; không sửa điều khoản | ✅ |
| `CLOSED` | Mọi mốc đã chi hoặc bị từ chối (tự chuyển khi duyệt chi mốc cuối) | Chỉ xem; lập biên bản thanh lý ⏳ | ✅ |
| `LIQUIDATED` | Đã thanh lý | Chỉ xem | ⏳ |

Hiện tại hợp đồng đi thẳng `DRAFT → ACTIVE` khi chủ hợp đồng bấm "Ký / kích hoạt".

### 7.2. Mốc

Trạng thái mốc do engine đặt sau mỗi lần chấm:

| Engine kết luận | Trạng thái mốc | Người dùng cần làm gì |
| --- | --- | --- |
| Giữ – thiếu chứng từ | **Chờ chứng từ** (`WAITING_EVIDENCE`) | Bên còn thiếu ghi chứng từ |
| Giữ – chưa đủ người duyệt | **Chờ duyệt** (`WAITING_APPROVAL`) | Người duyệt bấm phê duyệt |
| Giữ – tranh chấp / sai thẩm quyền / chưa rõ | **Đang giữ** (`ON_HOLD`) | Giải quyết tranh chấp, hoặc xử lý ngoại lệ |
| Từ chối | **Bị từ chối** (`REJECTED`) | Không trả; xem lý do |
| Trả tiền | **Đủ điều kiện trả** (`ELIGIBLE_FOR_PAYMENT`) | Duyệt tài chính bấm Duyệt chi |
| Trả có trừ phạt | **Trả có trừ phạt** (`PAID_WITH_PENALTY`) | Duyệt tài chính bấm Duyệt chi (đã trừ phạt) |
| (sau khi duyệt lệnh chi) | **Đã chi** | Xong, khóa |

Một mốc thường đi: **Chờ chứng từ → Chờ duyệt → Đủ điều kiện trả → Đã chi**. Có tranh chấp thì rẽ sang **Đang giữ**, đóng tranh chấp xong thì quay lại.

---

## 8. Ví dụ chạy thật: hợp đồng CT0019

Hợp đồng mẫu lấy từ dữ liệu thật của ban tổ chức cuộc thi: **Nova An** mua vật tư của **Phú Minh**, giá trị **1.970 triệu**, kiểu duyệt **hai người**, ân hạn 3 ngày, phạt 0,15%/ngày, trần 5%. Có sẵn 14 sự kiện.

Muốn làm lại từ đầu: chạy `pnpm db:seed` trong thư mục `apps/api`.

### 8.1. Kết quả engine sau khi nạp dữ liệu

| Mốc | Tiền | Sự kiện đã có | Engine | Vì sao |
| --- | --- | --- | --- | --- |
| 1. Ký hợp đồng | 394 | Ký hợp đồng, 2 phê duyệt | **Trả 394** | Đủ mọi điều kiện (luật 70) |
| 2. Giao hàng | 788 | Giao hàng, hóa đơn, 2 phê duyệt | **Trả 788** | Đủ mọi điều kiện (luật 70) |
| 3. Nghiệm thu | 591 | Nghiệm thu, 2 phê duyệt, **tranh chấp #8 đang mở** | **Giữ 0** | Đang tranh chấp (luật 10) |
| 4. Hết bảo hành | 197 | Hết bảo hành, 2 phê duyệt | **Trả 197** | Đủ mọi điều kiện (luật 70) |

### 8.2. Kịch bản 1: giải quyết tranh chấp

| Bước | Làm gì | Kết quả |
| --- | --- | --- |
| 1 | Đăng nhập **Nova An: chủ hợp đồng** → tab 3 → hợp đồng **#1** → mốc **Nghiệm thu** → "Sự kiện & cách chấm" | Thấy "Giữ tiền – Đang tranh chấp", luật 10 tô xanh |
| 2 | Loại sự kiện chọn **Đóng tranh chấp** → ô "Đóng tranh chấp nào" chọn **#8** → Ghi sự kiện | Engine tự chấm lại |
| 3 | Xem kết quả | **Trả 591 triệu**, luật 70 tô xanh; lịch sử chấm có 2 lần |

### 8.3. Kịch bản 2: hợp đồng mới từ đầu (mốc Giao hàng 400 triệu)

| Bước | Ai (đổi vai) | Làm gì | Engine chấm ra | Vì sao |
| --- | --- | --- | --- | --- |
| 0 | Chủ hợp đồng | Chọn hợp đồng **#2** → Ký / kích hoạt | Giữ – thiếu chứng từ | Chưa có sự kiện nào |
| 1 | Nhà cung cấp | Ghi **Giao hàng** | Giữ – thiếu chứng từ | Còn thiếu Hóa đơn |
| 2 | Nhà cung cấp | Ghi **Hóa đơn** | Giữ – chưa đủ người duyệt | Đã duyệt 0/2 |
| 3 | Chủ hợp đồng | Ghi **Phê duyệt** | Giữ – chưa đủ người duyệt | Đã duyệt 1/2 |
| 3b | Duyệt tài chính | Ghi **Phê duyệt** | Vẫn giữ, vẫn 1/2 | Hợp đồng "hai người" chỉ tính chủ hợp đồng + duyệt thứ hai |
| 4 | Duyệt thứ hai | Ghi **Phê duyệt** | **Trả 400 triệu** | Đủ mọi điều kiện |

### 8.4. Kịch bản 3: trễ hạn bị phạt (mốc Nghiệm thu 300 triệu của hợp đồng #2)

| Bước | Ai | Làm gì | Engine chấm ra |
| --- | --- | --- | --- |
| 1 | Pháp lý | Ghi **Nghiệm thu**, lúc xảy ra **20/01/2027** (hạn 04/01, ân hạn 3 ngày) | Giữ – chưa đủ người duyệt; ghi nhận trễ 13 ngày |
| 2 | Chủ hợp đồng | Ghi **Phê duyệt** | Giữ – 1/2 |
| 3 | Duyệt thứ hai | Ghi **Phê duyệt** | **Trả có trừ phạt: trả 294,15 tr, phạt 5,85 tr** (luật 60) |

### 8.5. Kịch bản 4: ghi sai thẩm quyền

| Bước | Ai | Làm gì | Engine chấm ra |
| --- | --- | --- | --- |
| 1 | Nhà cung cấp | Ở mốc **Ký hợp đồng** của hợp đồng #2, ghi **Ký hợp đồng** (việc của bên mua) | **Giữ – Chứng từ sai thẩm quyền** (luật 30) |

Sự kiện sai vẫn được lưu làm bằng chứng. Mốc này bị kẹt cho tới khi có quy trình ngoại lệ (mục 5.5).

> **Lưu ý khi thử:** chứng từ của bên mua (Ký hợp đồng, Nghiệm thu) phải do **pháp lý** ghi. Chủ hợp đồng thuộc nhóm "người duyệt" nên chỉ dùng để phê duyệt; nếu chủ hợp đồng ghi Nghiệm thu, engine cũng coi là sai thẩm quyền.

---

## 9. Nguyên tắc an toàn

| # | Nguyên tắc | Nghĩa là gì | Làm thế nào |
| --- | --- | --- | --- |
| 1 | **Chưa chắc thì giữ tiền** | Thà chậm trả còn hơn trả sai | Luật cuối luôn là "còn lại thì giữ tiền"; công bố phiên bản bắt buộc có luật này |
| 2 | **Trình duyệt không ra quyết định** | Giao diện chỉ hiển thị; người dùng sửa được mã trên trình duyệt nên không được tin | API kiểm quyền và nghiệp vụ; engine quyết định và tính tiền |
| 3 | **Không tin điều người dùng tự khai** | Người dùng không tự chọn mình là ai, thuộc bên nào | Bên ghi, vai trò, công ty lấy từ tài khoản đăng nhập; đọc lại từ DB mỗi lần gọi |
| 4 | **Tiền tính chính xác** | Không có lỗi làm tròn kiểu 0,1 + 0,2 = 0,30000000000000004 | Dùng số thập phân chính xác, không dùng số thực dấu phẩy động |
| 5 | **Dữ liệu đã chốt bị khóa ngay trong DB** | Kể cả lập trình viên gọi thẳng DB cũng không sửa được | Trigger PostgreSQL khóa: phiên bản đã công bố, hợp đồng đã kích hoạt, sự kiện, kết quả chấm |
| 6 | **Chỉ thêm, không sửa, không xóa** | Mọi thay đổi để lại dấu vết | Sự kiện và kết quả chấm chỉ được thêm; ghi nhầm thì đi qua ngoại lệ ⏳ |
| 7 | **Tách nhiệm** | Không một người nào làm được hết một việc nhạy cảm | Người cấu hình, người đề xuất ngoại lệ, người duyệt ngoại lệ, người duyệt chi là những người khác nhau |
| 8 | **Giải thích được mọi kết quả** | Ai hỏi "vì sao" cũng trả lời được | Mỗi lần chấm lưu toàn bộ con số và kết quả thử từng luật |

---

## 10. Kiến trúc và dữ liệu

### 10.1. Các khối của hệ thống

```
 ┌────────────────┐   HTTP / JSON    ┌──────────────────┐   TypeORM   ┌───────────────────┐
 │  Trình duyệt   │ ───────────────▶ │   API (NestJS)   │ ──────────▶ │   PostgreSQL      │
 │  HTML thử      │                  │  - đăng nhập JWT │             │  - 13 bảng        │
 │  (React ⏳)     │ ◀─────────────── │  - kiểm quyền    │ ◀────────── │  - trigger khóa   │
 └────────────────┘                  │  - nghiệp vụ     │             └───────────────────┘
                                     └────────┬─────────┘
                                              │ JSON qua stdin / stdout
                                              ▼
                                     ┌──────────────────┐
                                     │  Engine (Python) │
                                     │  chấm mốc,       │
                                     │  tính tiền       │
                                     └──────────────────┘
```

| Khối | Làm gì | Công nghệ |
| --- | --- | --- |
| Giao diện | Hiển thị, nhập liệu | HTML thử (`apps/api/public/app.html`); sẽ chuyển sang React + Vite |
| API | Đăng nhập, kiểm quyền, xử lý nghiệp vụ, gọi engine | NestJS, TypeORM; tài liệu API tại `/api/docs` (Swagger) |
| Cơ sở dữ liệu | Lưu trữ, khóa dữ liệu đã chốt | PostgreSQL 17 |
| Engine | Chấm mốc, tính tiền | Python (`apps/engine`) |

### 10.2. Các bảng hiện có (13 bảng, 5 nhóm)

```
 NHÓM 1: DANH MỤC          NHÓM 2: THƯ VIỆN MỐC              NHÓM 3: LOẠI HỢP ĐỒNG
 ┌──────────────┐          ┌───────────────────┐              ┌────────────────────────┐
 │ event_types  │          │ milestone_library │──┐           │ contract_types         │
 │ parties      │          └───────────────────┘  │           │ contract_type_milestones│
 │ users        │          ┌───────────────────┐  │           └────────────────────────┘
 └──────────────┘          │ milestone_versions│◀─┘                      │
                           └─────────┬─────────┘                         │ tạo hợp đồng
                           ┌─────────▼─────────┐                         ▼
                           │ payment_rules     │           NHÓM 4: HỢP ĐỒNG
                           └───────────────────┘           ┌────────────────────────┐
                                                           │ contracts              │
                                                           │ milestones             │
                                                           │ events                 │
                                                           └───────────┬────────────┘
                                                                       │ engine chấm
                                                     NHÓM 5: CHẤM VÀ CHI ▼
                                                           ┌────────────────────────┐
                                                           │ milestone_evaluations  │
                                                           │ payments               │
                                                           └────────────────────────┘
```

| Nhóm | Bảng | Lưu gì |
| --- | --- | --- |
| 1. Danh mục | `event_types` | 16+ loại sự kiện: nhóm, bên được ghi, trạng thái hợp lệ |
| | `parties` | Các bên: công ty mua, nhà cung cấp, người duyệt (thuộc một bên mua) |
| | `users` | Tài khoản: email, mật khẩu (đã băm), vai trò, thuộc bên nào |
| 2. Thư viện mốc | `milestone_library` | Mốc mẫu: tên |
| | `milestone_versions` | Phiên bản: sự kiện bắt buộc, có phạt trễ, trạng thái nháp / công bố / ngừng, có phải luật riêng |
| | `payment_rules` | Luật: ưu tiên, tên, điều kiện, quyết định, lý do, cách tính tiền |
| 3. Loại hợp đồng | `contract_types` | Loại hợp đồng: tên |
| | `contract_type_milestones` | Khuôn: mốc nào, bao nhiêu %, hạn sau bao nhiêu ngày |
| 4. Hợp đồng | `contracts` | Hợp đồng: các bên, giá trị, thời hạn, kiểu duyệt, ân hạn, phạt, trạng thái |
| | `milestones` | Mốc thật: thứ tự, phiên bản luật đang dùng, tiền, hạn |
| | `events` | Sự kiện: loại, bên ghi, người bấm, lúc xảy ra, số giấy tờ |
| 5. Chấm và chi | `milestone_evaluations` | Kết quả chấm: quyết định, tiền, luật, giải thích |
| | `payments` | Lệnh chi: chờ duyệt / đã chi / đã hủy, ai duyệt, mã giao dịch |

### 10.3. Bảng dự kiến

| Bảng | Dùng cho |
| --- | --- |
| `signatures` | Chữ ký của từng bên trên văn bản hợp đồng |
| `documents` | File chứng từ đính kèm sự kiện |
| `exceptions` | Đề xuất và quyết định vô hiệu sự kiện |
| `amendments` | Phụ lục dời hạn |
| `liquidations` | Biên bản thanh lý |
| `audit_log` | Nhật ký kiểm toán dạng chuỗi băm |

---

## 11. Hiện trạng và lộ trình

### 11.1. Đã làm được

Chạy trọn một vòng trên giao diện thử:

```
 Dựng mốc + luật ─▶ Công bố ─▶ Ghép loại hợp đồng ─▶ Tạo hợp đồng ─▶ Chỉnh riêng / luật riêng
   ─▶ Kích hoạt ─▶ Các bên ghi sự kiện ─▶ Engine tự chấm + giải thích + lịch sử
   ─▶ Tự lập lệnh chi ─▶ Duyệt tài chính duyệt chi ─▶ Mốc đã chi ─▶ Hợp đồng CLOSED
```

Kèm theo: đăng nhập, phân quyền theo vai và theo công ty, khóa dữ liệu bằng trigger, dữ liệu mẫu từ ban tổ chức, tài liệu API (Swagger).

### 11.2. Lộ trình tiếp theo

| Ưu tiên | Việc | Vì sao làm trước |
| --- | --- | --- |
| 1 | **Ký hai bên**: văn bản, mã băm, ký theo thứ tự | Hợp đồng chỉ có hiệu lực khi cả hai bên đồng ý |
| 2 | **Nhật ký kiểm toán** chuỗi băm | Các thao tác làm sau đều cần ghi nhật ký |
| 3 | **Xử lý ngoại lệ** hai người duyệt | Gỡ các mốc bị kẹt do ghi nhầm |
| 4 | **Chứng từ có file**, kiểm hóa đơn | Chứng từ có giá trị thật thay vì chỉ một dòng chữ |
| 5 | **Phụ lục, thanh lý** | Hoàn tất vòng đời hợp đồng |
| 6 | Kiểm an toàn bộ luật, quản lý tài khoản | Chặn cấu hình sai từ gốc |
| 7 | Việc cần làm, dashboard, cảnh báo trình tự, AI đọc PDF | Tiện ích, làm khi còn thời gian |

**Song song (yêu cầu của môn học):** chuyển giao diện sang **React + Vite**; viết ít nhất **15 test** (Vitest / React Testing Library), độ phủ **≥ 50%**.

---

## 12. Câu hỏi thường gặp

**Engine có tự ý trả tiền không?**
Không. Engine chỉ kết luận mốc **đủ điều kiện** trả. Tiền chỉ đi khi người duyệt tài chính bấm "Duyệt chi". Khi không chắc chắn, engine luôn giữ tiền.

**Ai nhập sự kiện? Hệ thống có tự sinh sự kiện không?**
Con người nhập: nhà cung cấp, pháp lý, người duyệt. Hệ thống chỉ tự điền phần không được để người dùng chọn: bên ghi, người bấm, trạng thái. Sau này khi làm phần ký, hệ thống sẽ tự ghi sự kiện "Ký hợp đồng" (⏳).

**Ghi nhầm sự kiện thì sao?**
Không xóa được. Hiện mốc sẽ bị giữ tiền. Khi có quy trình ngoại lệ (⏳), chủ hợp đồng đề xuất vô hiệu, kiểm soát viên duyệt, engine chấm lại.

**Sửa luật chung có làm đổi kết quả các hợp đồng đang chạy không?**
Không. Phiên bản đã công bố bị khóa; sửa luật là tạo phiên bản mới. Hợp đồng đang chạy vẫn dùng phiên bản lúc kích hoạt.

**Một khách hàng cần luật khác thì làm thế nào?**
Khi hợp đồng còn là bản nháp, bấm "Dùng luật riêng" ở mốc cần đổi. Hệ thống chép luật chung thành bản riêng của hợp đồng đó để sửa; luật chung không đổi.

**Vì sao mốc Giao hàng được trả dù mốc Ký hợp đồng còn đang giữ tiền?**
Hiện mỗi mốc được chấm **độc lập**, giống dữ liệu của ban tổ chức. Ràng buộc thứ tự giữa các mốc nằm trong lộ trình (⏳); khi làm phần ký hai bên, mốc Ký hợp đồng sẽ tự đủ chứng từ ngay lúc ký.

**Engine có dùng AI không?**
Không. Engine chấm theo luật rõ ràng nên lần nào chấm cũng ra cùng kết quả và giải thích được. AI chỉ được dự kiến dùng để **đề xuất** điều khoản khi đọc file PDF hợp đồng; người dùng phải xác nhận.

**Kiểm toán làm sao biết kết quả không bị sửa?**
Hiện tại: kết quả chấm chỉ được thêm, trigger trong DB chặn sửa và xóa. Khi có nhật ký kiểm toán chuỗi băm (⏳), mọi thao tác còn được niêm phong, sửa một dòng là bị phát hiện.

---

## 13. Phụ lục: danh mục có sẵn

### 13.1. 16 loại sự kiện có sẵn

| # | Loại sự kiện | Nhóm | Bên được ghi |
| --- | --- | --- | --- |
| 1 | Ký hợp đồng | Chứng từ | Bên mua |
| 2 | Xác nhận khởi động | Chứng từ | Bên mua |
| 3 | Duyệt yêu cầu | Chứng từ | Bên mua |
| 4 | Đạt kiểm thử người dùng (UAT) | Chứng từ | Bên mua |
| 5 | Nghiệm thu | Chứng từ | Bên mua |
| 6 | Giao hàng | Chứng từ | Nhà cung cấp |
| 7 | Hóa đơn | Chứng từ | Nhà cung cấp |
| 8 | Đưa vào vận hành | Chứng từ | Nhà cung cấp |
| 9 | Kích hoạt dịch vụ | Chứng từ | Nhà cung cấp |
| 10 | Hoàn thành dịch vụ | Chứng từ | Nhà cung cấp |
| 11 | Hết bảo hành | Chứng từ | Nhà cung cấp |
| 12 | Phê duyệt | Phê duyệt | Người duyệt của bên mua |
| 13 | Từ chối | Từ chối | Người duyệt của bên mua |
| 14 | Mở tranh chấp | Mở tranh chấp | Các bên |
| 15 | Đóng tranh chấp | Đóng tranh chấp | Các bên |
| 16 | Đề nghị đóng hợp đồng | Khác | |

### 13.2. 8 lý do của quyết định

| Mã | Tiếng Việt | Thường dẫn tới |
| --- | --- | --- |
| `OPEN_DISPUTE` | Đang tranh chấp | Giữ tiền → Đang giữ |
| `REJECTION_PRESENT` | Bên mua từ chối | Từ chối → Bị từ chối |
| `UNAUTHORIZED_EVENT` | Chứng từ sai thẩm quyền | Giữ tiền → Đang giữ |
| `MISSING_REQUIRED_EVENT` | Thiếu sự kiện bắt buộc | Giữ tiền → Chờ chứng từ |
| `APPROVAL_QUORUM_NOT_MET` | Chưa đủ người duyệt | Giữ tiền → Chờ duyệt |
| `LATE_COMPLETION` | Hoàn thành trễ hạn | Trả có trừ phạt (hoặc từ chối nếu trễ quá mức) |
| `ALL_CONDITIONS_MET` | Đủ mọi điều kiện | Trả tiền → Đủ điều kiện trả |
| `UNRESOLVED_CONDITION` | Chưa xác định được | Giữ tiền → Đang giữ |
