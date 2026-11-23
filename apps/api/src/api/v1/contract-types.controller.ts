import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { VersionedDto } from "../../schemas/common.schema";
import {
  AddTemplateMilestoneDto,
  ContractTypeListQuery,
  CreateContractTypeDto,
  UpdateContractTypeDto,
  UpdateTemplateMilestoneDto,
} from "../../schemas/contract-type.schema";
import { ContractTypeService } from "../../services/contract-type.service";

@ApiTags("contract-types")
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
  @ApiOperation({ summary: "Thêm loại hợp đồng" })
  create(@Body() dto: CreateContractTypeDto) {
    return this.service.createType(dto.name);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Đổi tên hoặc bật/tắt loại hợp đồng (gửi kèm version)" })
  update(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateContractTypeDto) {
    const { version, ...changes } = dto;
    return this.service.update(id, version, changes);
  }

  @Post(":id/milestones")
  @ApiOperation({ summary: "Ghép một mốc từ thư viện vào khuôn (%, hạn); mốc phải đã công bố, tổng không quá 100%" })
  addMilestone(@Param("id", ParseIntPipe) id: number, @Body() dto: AddTemplateMilestoneDto) {
    return this.service.addMilestone(id, dto);
  }
}

@ApiTags("contract-types")
@Controller("contract-type-milestones")
export class ContractTypeMilestonesController {
  constructor(private readonly service: ContractTypeService) {}

  @Patch(":id")
  @ApiOperation({ summary: "Sửa % hoặc hạn của một mốc trong khuôn (gửi kèm version)" })
  update(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateTemplateMilestoneDto) {
    return this.service.updateMilestone(id, dto);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Bỏ một mốc khỏi khuôn (?version=); hợp đồng đã tạo không bị ảnh hưởng" })
  remove(@Param("id", ParseIntPipe) id: number, @Query() { version }: VersionedDto) {
    return this.service.removeMilestone(id, version);
  }
}
