/**
 * Swagger groups, in the order of the workflow. Every controller uses one of these names, and
 * main.ts declares them in this order with their description, so /api/docs reads top to bottom.
 */
export const API_TAGS = [
  ["0 Đăng nhập", "Đăng nhập lấy token, tự đăng ký, xem mình là ai."],
  ["1.1 Loại sự kiện", "Danh mục các nút bấm để ghi sự kiện (Giao hàng, Hóa đơn, Phê duyệt...)."],
  ["1.2 Các bên", "Bên mua, nhà cung cấp, người phê duyệt của bên mua."],
  ["2.1 Thư viện mốc", "Mốc thanh toán dùng chung; mỗi mốc có các phiên bản."],
  ["2.2 Phiên bản mốc", "Điều kiện của một phiên bản (sự kiện bắt buộc, phạt trễ) và công bố."],
  ["2.3 Luật của phiên bản", "Luật nếu ... thì ... vì ... của một phiên bản nháp."],
  ["3.1 Loại hợp đồng", "Loại hợp đồng và khuôn của nó."],
  ["3.2 Khuôn mốc", "Mốc trong khuôn của loại hợp đồng: %, hạn."],
  ["4.1 Hợp đồng", "Tạo từ khuôn, sửa khi DRAFT, ký / kích hoạt."],
  ["4.2 Mốc của hợp đồng", "Sửa %, hạn, thêm / bỏ mốc, luật riêng (khi hợp đồng DRAFT)."],
  ["4.3 Sự kiện", "Ghi và xem sự kiện của một mốc (khi hợp đồng ACTIVE)."],
  ["4.4 Kết quả chấm", "Engine chấm từng mốc: trả / giữ / từ chối / phạt, vì sao, luật nào; lịch sử chấm."],
  ["4.5 Chi tiền", "Lệnh chi tự lập khi engine cho trả; duyệt tài chính bên mua duyệt thì chi (cổng thanh toán mô phỏng)."],
] as const;

type TagName = (typeof API_TAGS)[number][0];
const tag = <T extends TagName>(name: T): T => name;

export const TAG = {
  auth: tag("0 Đăng nhập"),
  eventTypes: tag("1.1 Loại sự kiện"),
  parties: tag("1.2 Các bên"),
  milestoneLibrary: tag("2.1 Thư viện mốc"),
  milestoneVersions: tag("2.2 Phiên bản mốc"),
  paymentRules: tag("2.3 Luật của phiên bản"),
  contractTypes: tag("3.1 Loại hợp đồng"),
  templateMilestones: tag("3.2 Khuôn mốc"),
  contracts: tag("4.1 Hợp đồng"),
  contractMilestones: tag("4.2 Mốc của hợp đồng"),
  events: tag("4.3 Sự kiện"),
  evaluations: tag("4.4 Kết quả chấm"),
  payments: tag("4.5 Chi tiền"),
} as const;
