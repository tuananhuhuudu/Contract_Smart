import { Controller, Get, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { TAG } from "../../core/api-tags";
import { CurrentUser, Roles, type AuthUser } from "../../core/security/decorators";
import { AuditListQuery } from "../../schemas/audit.schema";
import { AuditService } from "../../services/audit.service";

@ApiTags(TAG.audit)
@Controller("audit-log")
export class AuditController {
  constructor(private readonly service: AuditService) {}

  @Get()
  @ApiOperation({
    summary: "Nhật ký kiểm toán, mới nhất trước. Kiểm toán: tất cả; quản trị hệ thống: công ty và tài khoản; kiểm soát: hợp đồng và nhân viên công ty mình; quản trị công ty: tài khoản công ty mình; người khác: lịch sử hợp đồng của công ty mình",
  })
  list(@Query() query: AuditListQuery, @CurrentUser() user: AuthUser) {
    return this.service.list(query, user);
  }

  @Get("verify")
  @Roles("AUDITOR")
  @ApiOperation({ summary: "[Kiểm toán] Tính lại toàn bộ chuỗi băm: báo dòng đầu tiên bị sửa, bị xóa hoặc nối sai" })
  verify() {
    return this.service.verify();
  }
}
