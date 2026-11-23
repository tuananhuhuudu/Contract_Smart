import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { CreateEventDto } from "../../schemas/event.schema";
import { EventService } from "../../services/event.service";

/** Events are append-only: read and record, no update or delete. */
@ApiTags("events")
@Controller()
export class EventsController {
  constructor(private readonly service: EventService) {}

  @Get("milestones/:milestoneId/events")
  @ApiOperation({ summary: "Các sự kiện của một mốc, theo thứ tự thời gian" })
  listByMilestone(@Param("milestoneId") milestoneId: string) {
    return this.service.listByMilestone(milestoneId);
  }

  @Get("events/:eventId")
  @ApiOperation({ summary: "Một sự kiện" })
  get(@Param("eventId") eventId: string) {
    return this.service.getEvent(eventId);
  }

  @Post("events")
  @ApiOperation({ summary: "Ghi một sự kiện (giao hàng, hóa đơn, duyệt, tranh chấp...); không sửa, không xóa được" })
  record(@Body() dto: CreateEventDto) {
    return this.service.record(dto);
  }
}
