import { Injectable } from "@nestjs/common";
import { DataSource, In, type EntityManager } from "typeorm";
import { EventType } from "../models/event-type.entity";
import { BaseRepository } from "./base.repository";

@Injectable()
export class EventTypeRepository extends BaseRepository<EventType, "id"> {
  protected readonly entity = EventType;
  protected readonly idField = "id";
  protected readonly sortableFields = ["id", "name", "category"] as const;
  protected readonly defaultSort = "id";

  constructor(dataSource: DataSource) {
    super(dataSource);
  }

  /** The ids of `ids` that are missing from the catalogue or switched off. */
  async unusable(ids: readonly number[], db?: EntityManager): Promise<number[]> {
    const found = await this.repo(db).find({ where: { id: In([...ids]), active: true } });
    const ok = new Set(found.map((t) => t.id));
    return ids.filter((id) => !ok.has(id));
  }
}
