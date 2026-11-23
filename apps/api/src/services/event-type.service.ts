import { BadRequestException, Injectable } from "@nestjs/common";
import type { EventCategory, EventStatus, EventType } from "../models/event-type.entity";
import { EventTypeRepository } from "../repositories/event-type.repository";
import type { CreateEventTypeDto, EventTypeListQuery } from "../schemas/event-type.schema";
import type { Paginated } from "../utils/paging";
import { BaseService } from "./base.service";

/** The status every event of a category gets; the engine ignores an event whose status does not match. */
export const STATUS_OF: Record<EventCategory, EventStatus> = {
  EVIDENCE: "CONFIRMED", APPROVAL: "APPROVED", REJECTION: "REJECTED",
  DISPUTE_OPEN: "OPEN", DISPUTE_RESOLVE: "RESOLVED", OTHER: "CONFIRMED",
};

/** The event type catalogue. No delete: events keep pointing at their type; switch it off instead. */
@Injectable()
export class EventTypeService extends BaseService<EventType, "id"> {
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

  /** People pick the name, category and (for evidence) the side; the status follows from the category. */
  createType(dto: CreateEventTypeDto): Promise<EventType> {
    if (dto.category !== "EVIDENCE" && dto.actorSide)
      throw new BadRequestException("actorSide is only for EVIDENCE event types");
    return this.repository.create({
      name: dto.name.trim(), category: dto.category, validStatus: STATUS_OF[dto.category],
      actorSide: dto.category === "EVIDENCE" ? (dto.actorSide ?? null) : null,
    });
  }
}
