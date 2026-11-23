import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { TAG } from "../../core/api-tags";
import { EVENT_RECORDERS, NEGOTIATORS } from "../../core/security/access";
import { CurrentUser, Roles, type AuthUser } from "../../core/security/decorators";
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

@ApiTags(TAG.contracts)
@Controller("contracts")
export class ContractsController {
  constructor(private readonly service: ContractService) {}

  @Get()
  @ApiOperation({ summary: "Hợp đồng của tổ chức mình (quản trị, kiểm toán thấy hết); lọc theo trạng thái, loại, bên" })
  list(@Query() query: ContractListQuery, @CurrentUser() user: AuthUser) {
    return this.service.listContracts(query, user);
  }

  @Get(":id")
  @ApiOperation({ summary: "Một hợp đồng kèm các mốc (tiền, %, hạn, luật đang gắn), tổng tiền, đủ chưa" })
  get(@Param("id", ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.service.getContractFor(id, user);
  }

  @Post()
  @Roles(...NEGOTIATORS)
  @ApiOperation({ summary: "[Chủ hợp đồng, Pháp lý bên mua] Tạo hợp đồng DRAFT từ khuôn; bên mua phải là tổ chức của mình" })
  create(@Body() dto: CreateContractDto, @CurrentUser() user: AuthUser) {
    return this.service.createContract(dto, user);
  }

  @Patch(":id")
  @Roles(...NEGOTIATORS)
  @ApiOperation({ summary: "[Chủ hợp đồng, Pháp lý bên mua] Sửa điều khoản khi DRAFT (đổi giá trị thì chia lại tiền, đổi ngày bắt đầu thì dời hạn)" })
  update(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateContractDto, @CurrentUser() user: AuthUser) {
    return this.service.updateContract(id, dto, user);
  }

  @Post(":id/activate")
  @Roles("CONTRACT_OWNER")
  @ApiOperation({ summary: "[Chủ hợp đồng bên mua] Ký / kích hoạt: kiểm tra đủ tiền và luật riêng, rồi khóa (DRAFT -> ACTIVE)" })
  activate(@Param("id", ParseIntPipe) id: number, @Body() dto: VersionedDto, @CurrentUser() user: AuthUser) {
    return this.service.activate(id, dto.version, user);
  }
}

@ApiTags(TAG.contractMilestones)
@Controller()
@Roles(...NEGOTIATORS)
export class MilestonesController {
  constructor(private readonly service: ContractService) {}

  @Post("contracts/:id/milestones")
  @ApiOperation({ summary: "[Chủ hợp đồng, Pháp lý bên mua] Thêm một mốc từ thư viện cho riêng hợp đồng này (khi DRAFT)" })
  addMilestone(@Param("id", ParseIntPipe) id: number, @Body() dto: AddContractMilestoneDto, @CurrentUser() user: AuthUser) {
    return this.service.addMilestone(id, dto, user);
  }

  @Patch("milestones/:id")
  @ApiOperation({ summary: "[Chủ hợp đồng, Pháp lý bên mua] Sửa % hoặc hạn của một mốc (khi DRAFT)" })
  update(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateContractMilestoneDto, @CurrentUser() user: AuthUser) {
    return this.service.updateMilestone(id, dto, user);
  }

  @Delete("milestones/:id")
  @ApiOperation({ summary: "[Chủ hợp đồng, Pháp lý bên mua] Bỏ một mốc khỏi hợp đồng (khi DRAFT, ?version=)" })
  remove(@Param("id", ParseIntPipe) id: number, @Query() { version }: VersionedDto, @CurrentUser() user: AuthUser) {
    return this.service.removeMilestone(id, version, user);
  }

  @Post("milestones/:id/custom-rules")
  @ApiOperation({ summary: "[Chủ hợp đồng, Pháp lý bên mua] Dùng luật riêng cho mốc này (chép luật đang dùng thành bản nháp; sửa qua /milestone-versions)" })
  useCustomRules(@Param("id", ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.service.useCustomRules(id, user);
  }

  @Delete("milestones/:id/custom-rules")
  @ApiOperation({ summary: "[Chủ hợp đồng, Pháp lý bên mua] Bỏ luật riêng, quay về luật chung đang dùng trong thư viện" })
  useSharedRules(@Param("id", ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.service.useSharedRules(id, user);
  }
}

@ApiTags(TAG.events)
@Controller()
export class EventsController {
  constructor(private readonly service: EventService) {}

  @Get("milestones/:id/events")
  @ApiOperation({ summary: "Các sự kiện của một mốc, theo thời gian (chỉ hợp đồng của tổ chức mình)" })
  listByMilestone(@Param("id", ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.service.listByMilestone(id, user);
  }

  @Get("events/:id")
  @ApiOperation({ summary: "Một sự kiện" })
  get(@Param("id", ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.service.getEvent(id, user);
  }

  @Post("events")
  @Roles(...EVENT_RECORDERS)
  @ApiOperation({ summary: "[Các bên của hợp đồng] Ghi sự kiện cho bên của chính mình (hợp đồng phải ACTIVE; trạng thái tự điền)" })
  record(@Body() dto: CreateEventDto, @CurrentUser() user: AuthUser) {
    return this.service.record(dto, user);
  }
}
