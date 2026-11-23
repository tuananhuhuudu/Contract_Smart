import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { VersionedDto } from "../../schemas/common.schema";
import {
  ContractTypeListQuery,
  CreateContractTypeDto,
  CreateStageDto,
  UpdateContractTypeDto,
  UpdateStageDto,
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

  @Get(":code")
  @ApiOperation({ summary: "Một loại hợp đồng kèm khuôn mốc và tổng %" })
  get(@Param("code") code: string) {
    return this.service.getDetail(code);
  }

  @Post()
  @ApiOperation({ summary: "Tạo loại hợp đồng" })
  create(@Body() dto: CreateContractTypeDto) {
    return this.service.create(dto);
  }

  @Patch(":code")
  @ApiOperation({ summary: "Sửa tên hoặc bật/tắt loại hợp đồng (gửi kèm version)" })
  update(@Param("code") code: string, @Body() dto: UpdateContractTypeDto) {
    const { version, ...changes } = dto;
    return this.service.update(code, version, changes);
  }

  @Get(":code/stages")
  @ApiOperation({ summary: "Khuôn mốc của loại hợp đồng" })
  stages(@Param("code") code: string) {
    return this.service.listStages(code);
  }

  @Post(":code/stages")
  @ApiOperation({ summary: "Thêm một mốc mẫu (tổng % không quá 100)" })
  addStage(@Param("code") code: string, @Body() dto: CreateStageDto) {
    return this.service.addStage(code, dto);
  }

  @Patch(":code/stages/:sequence")
  @ApiOperation({ summary: "Sửa một mốc mẫu (gửi kèm version)" })
  updateStage(
    @Param("code") code: string,
    @Param("sequence", ParseIntPipe) sequence: number,
    @Body() dto: UpdateStageDto,
  ) {
    return this.service.updateStage(code, sequence, dto);
  }

  @Delete(":code/stages/:sequence")
  @HttpCode(204)
  @ApiOperation({ summary: "Xóa một mốc mẫu (?version=); hợp đồng đã tạo không bị ảnh hưởng" })
  removeStage(
    @Param("code") code: string,
    @Param("sequence", ParseIntPipe) sequence: number,
    @Query() { version }: VersionedDto,
  ) {
    return this.service.removeStage(code, sequence, version);
  }
}
