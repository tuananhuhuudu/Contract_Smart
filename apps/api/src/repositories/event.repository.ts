import { Injectable } from "@nestjs/common";
import { DataSource, type EntityManager } from "typeorm";
import { Event } from "../models/event.entity";
import { BaseRepository } from "./base.repository";

/** Events are append-only: only the read and create methods of the base are used (the database refuses the rest). */
@Injectable()
export class EventRepository extends BaseRepository<Event, "eventId"> {
  protected readonly entity = Event;
  protected readonly idField = "eventId";
  protected readonly sortableFields = ["eventId", "eventTimestamp", "eventType"] as const;
  protected readonly defaultSort = "eventTimestamp";

  constructor(dataSource: DataSource) {
    super(dataSource);
  }

  /** All events of one milestone, in the order they happened. */
  listByMilestone(milestoneId: string, db?: EntityManager): Promise<Event[]> {
    return this.repo(db).find({ where: { milestoneId }, order: { eventTimestamp: "ASC", eventId: "ASC" } });
  }
}
