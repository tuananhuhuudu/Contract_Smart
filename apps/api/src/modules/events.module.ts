import { Module } from "@nestjs/common";
import { EventsController } from "../api/v1/events.controller";
import { MilestoneRepository } from "../repositories/contract.repository";
import { EventRepository } from "../repositories/event.repository";
import { EventService } from "../services/event.service";

/** Events of the contracts (append-only). */
@Module({
  controllers: [EventsController],
  providers: [EventService, EventRepository, MilestoneRepository],
})
export class EventsModule {}
