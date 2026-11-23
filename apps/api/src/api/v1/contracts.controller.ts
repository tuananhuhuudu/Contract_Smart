import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { VersionedDto } from "../../schemas/common.schema";
import {
  AddContractMilestoneDto,
  ContractListQuery,
  CreateContractDto,
  CreateEventDto,
  UpdateContractDto,
  UpdateContractMilestoneDto,
} from "../../schemas/contract.schema";
import { ContractService } from "../../services/contract.service";
import { EventService } from "../../services/event.service";

@ApiTags("contracts")
@Controller("contracts")
export class ContractsController {
  constructor(private readonly service: ContractService) {}

  @Get()
  @ApiOperation({ summary: "Danh sách hợp đồng (lọc theo trạng thái, loại, bên mua, nhà cung cấp)" })
  list(@Query() query: ContractListQuery) {
    return this.service.listContracts(query);
  }

  @Get(":id")
  @ApiOperation({ summary: "Một hợp đồng kèm các mốc (tiền, %, hạn, luật đang gắn), tổng tiền, đủ chưa" })
  get(@Param("id", ParseIntPipe) id: number) {
    return this.service.getContract(id);
  }

  @Post()
  @ApiOperation({ summary: "Tạo hợp đồng DRAFT từ khuôn của loại hợp đồng (sinh mốc: tiền = % x giá trị, hạn = bắt đầu + số ngày)" })
  create(@Body() dto: CreateContractDto) {
    return this.service.createContract(dto);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Sửa điều khoản khi còn DRAFT (đổi giá trị thì chia lại tiền mốc, đổi ngày bắt đầu thì dời hạn)" })
  update(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateContractDto) {
    return this.service.updateContract(id, dto);
  }

  @Post(":id/milestones")
  @ApiOperation({ summary: "Thêm một mốc từ thư viện cho riêng hợp đồng này (khi DRAFT)" })
  addMilestone(@Param("id", ParseIntPipe) id: number, @Body() dto: AddContractMilestoneDto) {
    return this.service.addMilestone(id, dto);
  }

  @Post(":id/activate")
  @ApiOperation({ summary: "Ký / kích hoạt: kiểm tra đủ tiền và luật riêng, rồi khóa hợp đồng (DRAFT -> ACTIVE)" })
  activate(@Param("id", ParseIntPipe) id: number, @Body() dto: VersionedDto) {
    return this.service.activate(id, dto.version);
  }
}

@ApiTags("contracts")
@Controller("milestones")
export class MilestonesController {
  constructor(
    private readonly service: ContractService,
    private readonly events: EventService,
  ) {}

  @Patch(":id")
  @ApiOperation({ summary: "Sửa % hoặc hạn của một mốc (khi DRAFT)" })
  update(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateContractMilestoneDto) {
    return this.service.updateMilestone(id, dto);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Bỏ một mốc khỏi hợp đồng (khi DRAFT, ?version=)" })
  remove(@Param("id", ParseIntPipe) id: number, @Query() { version }: VersionedDto) {
    return this.service.removeMilestone(id, version);
  }

  @Post(":id/custom-rules")
  @ApiOperation({ summary: "Dùng luật riêng cho mốc này (chép luật đang dùng thành bản nháp; sửa qua /milestone-versions)" })
  useCustomRules(@Param("id", ParseIntPipe) id: number) {
    return this.service.useCustomRules(id);
  }

  @Delete(":id/custom-rules")
  @ApiOperation({ summary: "Bỏ luật riêng, quay về luật chung đang dùng trong thư viện" })
  useSharedRules(@Param("id", ParseIntPipe) id: number) {
    return this.service.useSharedRules(id);
  }

  @Get(":id/events")
  @ApiOperation({ summary: "Các sự kiện của một mốc, theo thời gian" })
  listEvents(@Param("id", ParseIntPipe) id: number) {
    return this.events.listByMilestone(id);
  }
}

@ApiTags("events")
@Controller("events")
export class EventsController {
  constructor(private readonly service: EventService) {}

  @Get(":id")
  @ApiOperation({ summary: "Một sự kiện" })
  get(@Param("id", ParseIntPipe) id: number) {
    return this.service.getEvent(id);
  }

  @Post()
  @ApiOperation({ summary: "Ghi sự kiện (hợp đồng phải ACTIVE; trạng thái tự điền; đóng tranh chấp phải chỉ rõ tranh chấp nào)" })
  record(@Body() dto: CreateEventDto) {
    return this.service.record(dto);
  }
}
