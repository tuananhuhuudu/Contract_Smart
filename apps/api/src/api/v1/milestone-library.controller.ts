import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { TAG } from "../../core/api-tags";
import { NEGOTIATORS } from "../../core/security/access";
import { CurrentUser, Roles, type AuthUser } from "../../core/security/decorators";
import { VersionedDto } from "../../schemas/common.schema";
import {
  CreateMilestoneDto,
  CreateRuleDto,
  MilestoneListQuery,
  UpdateMilestoneDto,
  UpdateRuleDto,
  UpdateVersionDto,
} from "../../schemas/milestone-library.schema";
import { MilestoneLibraryService } from "../../services/milestone-library.service";

@ApiTags(TAG.milestoneLibrary)
@Controller("milestone-library")
export class MilestoneLibraryController {
  constructor(private readonly service: MilestoneLibraryService) {}

  @Get()
  @ApiOperation({ summary: "Thư viện mốc (lọc theo đang dùng)" })
  list(@Query() query: MilestoneListQuery) {
    return this.service.listMilestones(query);
  }

  @Get(":id")
  @ApiOperation({ summary: "Một mốc kèm các phiên bản chung" })
  get(@Param("id", ParseIntPipe) id: number) {
    return this.service.getMilestone(id);
  }

  @Post()
  @Roles("SYSTEM_ADMIN")
  @ApiOperation({ summary: "[Quản trị] Thêm mốc (tạo sẵn phiên bản nháp v1, có thể chép luật từ mốc khác)" })
  create(@Body() dto: CreateMilestoneDto) {
    return this.service.createMilestone(dto);
  }

  @Patch(":id")
  @Roles("SYSTEM_ADMIN")
  @ApiOperation({ summary: "[Quản trị] Đổi tên hoặc bật/tắt mốc (gửi kèm version)" })
  update(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateMilestoneDto) {
    const { version, ...changes } = dto;
    return this.service.update(id, version, changes);
  }

  @Post(":id/versions")
  @Roles("SYSTEM_ADMIN")
  @ApiOperation({ summary: "[Quản trị] Tạo phiên bản nháp mới để sửa (chép từ phiên bản đang dùng)" })
  createVersion(@Param("id", ParseIntPipe) id: number) {
    return this.service.createVersion(id);
  }
}

@ApiTags(TAG.milestoneVersions)
@Controller("milestone-versions")
export class MilestoneVersionsController {
  constructor(private readonly service: MilestoneLibraryService) {}

  @Get(":id")
  @ApiOperation({ summary: "Một phiên bản mốc kèm các luật" })
  get(@Param("id", ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.service.getVersionFor(id, user);
  }

  @Patch(":id")
  @Roles("SYSTEM_ADMIN", ...NEGOTIATORS)
  @ApiOperation({ summary: "[Quản trị; luật riêng: bên mua của hợp đồng] Sửa điều kiện của bản nháp: sự kiện bắt buộc, phạt trễ, ghi chú" })
  update(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateVersionDto, @CurrentUser() user: AuthUser) {
    return this.service.updateVersion(id, dto, user);
  }

  @Post(":id/publish")
  @Roles("SYSTEM_ADMIN")
  @ApiOperation({ summary: "[Quản trị] Công bố bản nháp (kiểm tra đủ, khóa lại, phiên bản đang dùng chuyển RETIRED)" })
  publish(@Param("id", ParseIntPipe) id: number, @Body() dto: VersionedDto) {
    return this.service.publishVersion(id, dto.version);
  }
}

@ApiTags(TAG.paymentRules)
@Controller()
@Roles("SYSTEM_ADMIN", ...NEGOTIATORS)
export class PaymentRulesController {
  constructor(private readonly service: MilestoneLibraryService) {}

  @Post("milestone-versions/:id/rules")
  @ApiOperation({ summary: "[Quản trị; luật riêng: bên mua của hợp đồng] Thêm luật vào bản nháp" })
  addRule(@Param("id", ParseIntPipe) id: number, @Body() dto: CreateRuleDto, @CurrentUser() user: AuthUser) {
    return this.service.addRule(id, dto, user);
  }

  @Patch("payment-rules/:id")
  @ApiOperation({ summary: "[Quản trị; luật riêng: bên mua của hợp đồng] Sửa một luật của bản nháp (gửi kèm version)" })
  update(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateRuleDto, @CurrentUser() user: AuthUser) {
    return this.service.updateRule(id, dto, user);
  }

  @Delete("payment-rules/:id")
  @HttpCode(204)
  @ApiOperation({ summary: "[Quản trị; luật riêng: bên mua của hợp đồng] Xóa một luật của bản nháp (?version=)" })
  remove(@Param("id", ParseIntPipe) id: number, @Query() { version }: VersionedDto, @CurrentUser() user: AuthUser) {
    return this.service.removeRule(id, version, user);
  }
}
