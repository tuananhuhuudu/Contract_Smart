import { Body, Controller, Get, Param, ParseIntPipe, ParseUUIDPipe, Patch, Post, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { TAG } from "../../core/api-tags";
import { CurrentUser, Roles, type AuthUser } from "../../core/security/decorators";
import { CreateOrganizationDto, CreateUserDto, ResetPasswordDto, UpdateOrganizationDto, UpdateUserDto, UserListQuery } from "../../schemas/account.schema";
import { AccountService } from "../../services/account.service";

@ApiTags(TAG.accounts)
@Controller()
export class AccountsController {
  constructor(private readonly service: AccountService) {}

  @Post("organizations")
  @Roles("SYSTEM_ADMIN")
  @ApiOperation({ summary: "[Quản trị hệ thống] Mở một công ty (bên mua / nhà cung cấp) kèm tài khoản quản trị công ty đầu tiên" })
  createOrganization(@Body() dto: CreateOrganizationDto, @CurrentUser() user: AuthUser) {
    return this.service.createOrganization(dto, user);
  }

  @Patch("organizations/:id")
  @Roles("SYSTEM_ADMIN")
  @ApiOperation({ summary: "[Quản trị hệ thống] Khóa / mở khóa cả công ty: khi khóa, nhân viên công ty không đăng nhập được" })
  updateOrganization(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateOrganizationDto, @CurrentUser() user: AuthUser) {
    return this.service.updateOrganization(id, dto, user);
  }

  @Get("users")
  @Roles("SYSTEM_ADMIN", "ORG_ADMIN")
  @ApiOperation({ summary: "[Quản trị hệ thống: mọi tài khoản; Quản trị công ty: công ty mình] Danh sách tài khoản" })
  list(@Query() query: UserListQuery, @CurrentUser() user: AuthUser) {
    return this.service.listUsers(query, user);
  }

  @Post("users")
  @Roles("SYSTEM_ADMIN", "ORG_ADMIN")
  @ApiOperation({ summary: "[Quản trị công ty] Tạo nhân viên của công ty mình với vai hợp loại công ty. [Quản trị hệ thống] Tạo tài khoản nền tảng hoặc thêm quản trị cho một công ty" })
  create(@Body() dto: CreateUserDto, @CurrentUser() user: AuthUser) {
    return this.service.createUser(dto, user);
  }

  @Patch("users/:id")
  @Roles("SYSTEM_ADMIN", "ORG_ADMIN")
  @ApiOperation({ summary: "[Cùng phạm vi] Đổi tên, đổi vai, khóa / mở khóa tài khoản (không tự đổi vai hay tự khóa mình)" })
  update(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateUserDto, @CurrentUser() user: AuthUser) {
    return this.service.updateUser(id, dto, user);
  }

  @Post("users/:id/reset-password")
  @Roles("SYSTEM_ADMIN", "ORG_ADMIN")
  @ApiOperation({ summary: "[Cùng phạm vi] Đặt mật khẩu mới cho người quên mật khẩu" })
  resetPassword(@Param("id", ParseUUIDPipe) id: string, @Body() dto: ResetPasswordDto, @CurrentUser() user: AuthUser) {
    return this.service.resetPassword(id, dto.password, user);
  }
}
