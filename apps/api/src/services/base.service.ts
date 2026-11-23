import type { DeepPartial, EntityManager, ObjectLiteral } from "typeorm";
import type { BaseRepository } from "../repositories/base.repository";
import type { ListQueryDto } from "../schemas/base.schema";
import type { Paginated } from "../utils/paging";

/**
 * Generic service (BaseService of the chatbot): the read and write operations every feature
 * shares. Feature services extend it and add their business rules; transactions are opened here,
 * in the service layer, with `dataSource.transaction(async (db) => ...)`, and `db` is passed down.
 */
export abstract class BaseService<T extends ObjectLiteral, K extends keyof T & string> {
  constructor(protected readonly repository: BaseRepository<T, K>) {}

  getById(id: T[K], db?: EntityManager): Promise<T> {
    return this.repository.findById(id, db);
  }

  list(query: ListQueryDto, db?: EntityManager): Promise<Paginated<T>> {
    return this.repository.findPage(query, {}, db);
  }

  create(data: DeepPartial<T>, db?: EntityManager): Promise<T> {
    return this.repository.create(data, db);
  }

  update(id: T[K], expectedVersion: number, data: Partial<T>, db?: EntityManager): Promise<T> {
    return this.repository.update(id, expectedVersion, data, db);
  }

  /** 405 unless the repository allows deleting. */
  remove(id: T[K], expectedVersion: number, db?: EntityManager): Promise<void> {
    return this.repository.delete(id, expectedVersion, db);
  }
}
