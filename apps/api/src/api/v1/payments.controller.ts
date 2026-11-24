import { Body, Controller, Get, Param, ParseIntPipe, Post, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { TAG } from "../../core/api-tags";
import { CurrentUser, Roles, type AuthUser } from "../../core/security/decorators";
import { VersionedDto } from "../../schemas/common.schema";
import { PaymentListQuery } from "../../schemas/payment.schema";
import { PaymentService } from "../../services/payment.service";

@ApiTags(TAG.payments)
@Controller("payments")
export class PaymentsController {
  constructor(private readonly service: PaymentService) {}

  @Get()
  @ApiOperation({ summary: "Lệnh chi của các hợp đồng thuộc tổ chức mình (quản trị, kiểm toán thấy hết); lọc theo hợp đồng, trạng thái" })
  list(@Query() query: PaymentListQuery, @CurrentUser() user: AuthUser) {
    return this.service.list(query, user);
  }

  @Get(":id")
  @ApiOperation({ summary: "Một lệnh chi" })
  get(@Param("id", ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.service.get(id, user);
  }

  @Post(":id/approve")
  @Roles("FINANCE_APPROVER")
  @ApiOperation({ summary: "[Duyệt tài chính bên mua] Duyệt chi: kiểm lại với lần chấm mới nhất, gửi cổng thanh toán (mô phỏng), mốc thành đã chi" })
  approve(@Param("id", ParseIntPipe) id: number, @Body() dto: VersionedDto, @CurrentUser() user: AuthUser) {
    return this.service.approve(id, dto.version, user);
  }
}
