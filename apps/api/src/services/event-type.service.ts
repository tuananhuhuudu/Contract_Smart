import { BadRequestException, Injectable } from "@nestjs/common";
import type { EventType } from "../models/event-type.entity";
import { EventTypeRepository } from "../repositories/event-type.repository";
import type { CreateEventTypeDto, EventTypeListQuery } from "../schemas/event-type.schema";
import type { Paginated } from "../utils/paging";
import { BaseService } from "./base.service";

/** The event type catalogue. No delete: events keep pointing at their type; switch it off instead. */
@Injectable()
export class EventTypeService extends BaseService<EventType, "code"> {
  constructor(repository: EventTypeRepository) {
    super(repository);
  }

  listTypes(query: EventTypeListQuery): Promise<Paginated<EventType>> {
    const where = {
      ...(query.category ? { category: query.category } : {}),
      ...(query.active === undefined ? {} : { active: query.active }),
    };
    return this.repository.findPage({ ...query, order: query.sortBy ? query.order : "asc" }, where);
  }

  createType(dto: CreateEventTypeDto): Promise<EventType> {
    if (dto.category !== "EVIDENCE" && dto.actorSide)
      throw new BadRequestException("actorSide is only for EVIDENCE event types");
    return this.repository.create({ ...dto, actorSide: dto.category === "EVIDENCE" ? (dto.actorSide ?? null) : null });
  }
}
