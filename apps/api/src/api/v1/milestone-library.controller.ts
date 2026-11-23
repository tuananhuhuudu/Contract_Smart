import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
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

@ApiTags("milestone-library")
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
  @ApiOperation({ summary: "Thêm mốc (tạo sẵn phiên bản nháp v1, có thể chép luật từ mốc khác)" })
  create(@Body() dto: CreateMilestoneDto) {
    return this.service.createMilestone(dto);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Đổi tên hoặc bật/tắt mốc (gửi kèm version)" })
  update(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateMilestoneDto) {
    const { version, ...changes } = dto;
    return this.service.update(id, version, changes);
  }

  @Post(":id/versions")
  @ApiOperation({ summary: "Tạo phiên bản nháp mới để sửa (chép từ phiên bản đang dùng)" })
  createVersion(@Param("id", ParseIntPipe) id: number) {
    return this.service.createVersion(id);
  }
}

@ApiTags("milestone-library")
@Controller("milestone-versions")
export class MilestoneVersionsController {
  constructor(private readonly service: MilestoneLibraryService) {}

  @Get(":id")
  @ApiOperation({ summary: "Một phiên bản mốc kèm các luật" })
  get(@Param("id", ParseIntPipe) id: number) {
    return this.service.getVersion(id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Sửa điều kiện của bản nháp: sự kiện bắt buộc, phạt trễ, ghi chú" })
  update(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateVersionDto) {
    return this.service.updateVersion(id, dto);
  }

  @Post(":id/publish")
  @ApiOperation({ summary: "Công bố bản nháp (kiểm tra đủ, khóa lại, phiên bản đang dùng chuyển RETIRED)" })
  publish(@Param("id", ParseIntPipe) id: number, @Body() dto: VersionedDto) {
    return this.service.publishVersion(id, dto.version);
  }

  @Post(":id/rules")
  @ApiOperation({ summary: "Thêm luật vào bản nháp" })
  addRule(@Param("id", ParseIntPipe) id: number, @Body() dto: CreateRuleDto) {
    return this.service.addRule(id, dto);
  }
}

@ApiTags("milestone-library")
@Controller("payment-rules")
export class PaymentRulesController {
  constructor(private readonly service: MilestoneLibraryService) {}

  @Patch(":id")
  @ApiOperation({ summary: "Sửa một luật của bản nháp (gửi kèm version)" })
  update(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateRuleDto) {
    return this.service.updateRule(id, dto);
  }

  @Delete(":id")
  @HttpCode(204)
  @ApiOperation({ summary: "Xóa một luật của bản nháp (?version=)" })
  remove(@Param("id", ParseIntPipe) id: number, @Query() { version }: VersionedDto) {
    return this.service.removeRule(id, version);
  }
}
