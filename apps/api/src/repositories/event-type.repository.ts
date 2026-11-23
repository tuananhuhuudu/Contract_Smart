import { Injectable } from "@nestjs/common";
import { DataSource, In, type EntityManager } from "typeorm";
import { EventType } from "../models/event-type.entity";
import { BaseRepository } from "./base.repository";

@Injectable()
export class EventTypeRepository extends BaseRepository<EventType, "code"> {
  protected readonly entity = EventType;
  protected readonly idField = "code";
  protected readonly sortableFields = ["code", "name", "category"] as const;
  protected readonly defaultSort = "code";

  constructor(dataSource: DataSource) {
    super(dataSource);
  }

  /** The codes of `codes` that are missing from the catalogue or switched off. */
  async unusable(codes: readonly string[], db?: EntityManager): Promise<string[]> {
    const found = await this.repo(db).find({ where: { code: In([...codes]), active: true } });
    const ok = new Set(found.map((t) => t.code));
    return codes.filter((code) => !ok.has(code));
  }
}
