import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { TAG } from "../../core/api-tags";
import { Roles } from "../../core/security/decorators";
import { VersionedDto } from "../../schemas/common.schema";
import {
  AddTemplateMilestoneDto,
  ContractTypeListQuery,
  CreateContractTypeDto,
  UpdateContractTypeDto,
  UpdateTemplateMilestoneDto,
} from "../../schemas/contract-type.schema";
import { ContractTypeService } from "../../services/contract-type.service";

@ApiTags(TAG.contractTypes)
@Controller("contract-types")
export class ContractTypesController {
  constructor(private readonly service: ContractTypeService) {}

  @Get()
  @ApiOperation({ summary: "Danh sách loại hợp đồng" })
  list(@Query() query: ContractTypeListQuery) {
    return this.service.listTypes(query);
  }

  @Get(":id")
  @ApiOperation({ summary: "Một loại hợp đồng kèm khuôn mốc (tổng %, đủ 100% chưa)" })
  get(@Param("id", ParseIntPipe) id: number) {
    return this.service.getType(id);
  }

  @Post()
  @Roles("SYSTEM_ADMIN")
  @ApiOperation({ summary: "[Quản trị] Thêm loại hợp đồng" })
  create(@Body() dto: CreateContractTypeDto) {
    return this.service.createType(dto.name);
  }

  @Patch(":id")
  @Roles("SYSTEM_ADMIN")
  @ApiOperation({ summary: "[Quản trị] Đổi tên hoặc bật/tắt loại hợp đồng (gửi kèm version)" })
  update(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateContractTypeDto) {
    const { version, ...changes } = dto;
    return this.service.update(id, version, changes);
  }
}

@ApiTags(TAG.templateMilestones)
@Controller()
@Roles("SYSTEM_ADMIN")
export class ContractTypeMilestonesController {
  constructor(private readonly service: ContractTypeService) {}

  @Post("contract-types/:id/milestones")
  @ApiOperation({ summary: "Ghép một mốc từ thư viện vào khuôn (%, hạn); mốc phải đã công bố, tổng không quá 100%" })
  addMilestone(@Param("id", ParseIntPipe) id: number, @Body() dto: AddTemplateMilestoneDto) {
    return this.service.addMilestone(id, dto);
  }

  @Patch("contract-type-milestones/:id")
  @ApiOperation({ summary: "Sửa % hoặc hạn của một mốc trong khuôn (gửi kèm version)" })
  update(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateTemplateMilestoneDto) {
    return this.service.updateMilestone(id, dto);
  }

  @Delete("contract-type-milestones/:id")
  @ApiOperation({ summary: "Bỏ một mốc khỏi khuôn (?version=); hợp đồng đã tạo không bị ảnh hưởng" })
  remove(@Param("id", ParseIntPipe) id: number, @Query() { version }: VersionedDto) {
    return this.service.removeMilestone(id, version);
  }
}
