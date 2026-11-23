import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { CreateEventTypeDto, EventTypeListQuery, UpdateEventTypeDto } from "../../schemas/event-type.schema";
import { EventTypeService } from "../../services/event-type.service";

@ApiTags("event-types")
@Controller("event-types")
export class EventTypesController {
  constructor(private readonly service: EventTypeService) {}

  @Get()
  @ApiOperation({ summary: "Danh mục loại sự kiện (lọc theo nhóm, đang dùng)" })
  list(@Query() query: EventTypeListQuery) {
    return this.service.listTypes(query);
  }

  @Get(":code")
  @ApiOperation({ summary: "Một loại sự kiện" })
  get(@Param("code") code: string) {
    return this.service.getById(code);
  }

  @Post()
  @ApiOperation({ summary: "Thêm loại sự kiện (chứng từ phải ghi rõ bên nào được ghi)" })
  create(@Body() dto: CreateEventTypeDto) {
    return this.service.createType(dto);
  }

  @Patch(":code")
  @ApiOperation({ summary: "Đổi tên hoặc bật/tắt loại sự kiện (gửi kèm version); không xóa được" })
  update(@Param("code") code: string, @Body() dto: UpdateEventTypeDto) {
    const { version, ...changes } = dto;
    return this.service.update(code, version, changes);
  }
}
