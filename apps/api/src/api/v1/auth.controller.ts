import { Body, Controller, Get, HttpCode, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { TAG } from "../../core/api-tags";
import { CurrentUser, Public, type AuthUser } from "../../core/security/decorators";
import { LoginDto, RegisterDto } from "../../schemas/auth.schema";
import { AuthService } from "../../services/auth.service";

@ApiTags(TAG.auth)
@Controller("auth")
export class AuthController {
  constructor(private readonly service: AuthService) {}

  @Public()
  @Post("login")
  @HttpCode(200)
  @ApiOperation({ summary: "Đăng nhập: trả accessToken; bấm Authorize ở đầu trang, dán token vào" })
  login(@Body() dto: LoginDto) {
    return this.service.login(dto);
  }

  @Public()
  @Post("register")
  @ApiOperation({ summary: "Tự đăng ký: tài khoản chỉ xem (AUDITOR) cho tới khi quản trị gán vai trò" })
  register(@Body() dto: RegisterDto) {
    return this.service.register(dto);
  }

  @Get("me")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Người đang đăng nhập (vai trò, bên)" })
  me(@CurrentUser() user: AuthUser) {
    return user;
  }
}
