import { Module } from "@nestjs/common";
import { EventTypesController } from "../api/v1/event-types.controller";
import { EventTypeRepository } from "../repositories/event-type.repository";
import { EventTypeService } from "../services/event-type.service";

/** The event type catalogue. */
@Module({
  controllers: [EventTypesController],
  providers: [EventTypeService, EventTypeRepository],
  exports: [EventTypeRepository],
})
export class EventTypesModule {}
