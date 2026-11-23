import { Injectable } from "@nestjs/common";
import { DataSource, type EntityManager } from "typeorm";
import { Event } from "../models/event.entity";
import { BaseRepository } from "./base.repository";

@Injectable()
export class EventRepository extends BaseRepository<Event & { version: number }, "id"> {
  protected readonly entity = Event;
  protected readonly idField = "id";
  protected readonly sortableFields = ["id", "happenedAt"] as const;
  protected readonly defaultSort = "happenedAt";

  constructor(dataSource: DataSource) {
    super(dataSource);
  }

  /** Events of a milestone in the order they happened. */
  listByMilestone(milestoneId: number, db?: EntityManager): Promise<Event[]> {
    return this.repo(db).find({ where: { milestoneId }, relations: { eventType: true }, order: { happenedAt: "ASC", id: "ASC" } });
  }
}
