import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { TAG } from "../../core/api-tags";
import { Roles } from "../../core/security/decorators";
import { CreateEventTypeDto, EventTypeListQuery, UpdateEventTypeDto } from "../../schemas/event-type.schema";
import { EventTypeService } from "../../services/event-type.service";

@ApiTags(TAG.eventTypes)
@Controller("event-types")
export class EventTypesController {
  constructor(private readonly service: EventTypeService) {}

  @Get()
  @ApiOperation({ summary: "Danh mục loại sự kiện (lọc theo nhóm, đang dùng)" })
  list(@Query() query: EventTypeListQuery) {
    return this.service.listTypes(query);
  }

  @Get(":id")
  @ApiOperation({ summary: "Một loại sự kiện" })
  get(@Param("id", ParseIntPipe) id: number) {
    return this.service.getById(id);
  }

  @Post()
  @Roles("SYSTEM_ADMIN")
  @ApiOperation({ summary: "[Quản trị] Thêm loại sự kiện (chứng từ phải ghi rõ bên nào được ghi; trạng thái tự suy từ nhóm)" })
  create(@Body() dto: CreateEventTypeDto) {
    return this.service.createType(dto);
  }

  @Patch(":id")
  @Roles("SYSTEM_ADMIN")
  @ApiOperation({ summary: "[Quản trị] Đổi tên hoặc bật/tắt loại sự kiện (gửi kèm version); không xóa được" })
  update(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateEventTypeDto) {
    const { version, ...changes } = dto;
    return this.service.update(id, version, changes);
  }
}
