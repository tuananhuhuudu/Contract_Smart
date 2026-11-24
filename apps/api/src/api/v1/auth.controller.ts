import { Body, Controller, Get, HttpCode, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { TAG } from "../../core/api-tags";
import { CurrentUser, Public, type AuthUser } from "../../core/security/decorators";
import { ChangePasswordDto } from "../../schemas/account.schema";
import { LoginDto } from "../../schemas/auth.schema";
import { AccountService } from "../../services/account.service";
import { AuthService } from "../../services/auth.service";

@ApiTags(TAG.auth)
@Controller("auth")
export class AuthController {
  constructor(
    private readonly service: AuthService,
    private readonly accounts: AccountService,
  ) {}

  @Public()
  @Post("login")
  @HttpCode(200)
  @ApiOperation({ summary: "Đăng nhập: trả accessToken; bấm Authorize ở đầu trang, dán token vào" })
  login(@Body() dto: LoginDto) {
    return this.service.login(dto);
  }

  @Post("change-password")
  @HttpCode(204)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Tự đổi mật khẩu của mình (cần mật khẩu hiện tại)" })
  async changePassword(@Body() dto: ChangePasswordDto, @CurrentUser() user: AuthUser) {
    await this.accounts.changeOwnPassword(dto, user);
  }

  @Get("me")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Người đang đăng nhập (vai trò, bên)" })
  me(@CurrentUser() user: AuthUser) {
    return user;
  }
}
