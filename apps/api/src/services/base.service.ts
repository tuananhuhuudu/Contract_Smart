import type { DbClient } from "../core/prisma.service";
import type { BaseRepository } from "../repositories/base.repository";
import type { ListQueryDto } from "../schemas/base.schema";
import type { Paginated } from "../utils/paging";

/**
 * Generic service (BaseService of the chatbot): the read and write operations every feature
 * shares. Feature services extend it and add their business rules (permissions, workflow,
 * audit) by overriding or adding methods; transactions are opened here, in the service layer.
 */
export abstract class BaseService<T, K extends keyof T & string, C, U> {
  constructor(protected readonly repository: BaseRepository<T, K, C, U>) {}

  getById(id: T[K], db?: DbClient): Promise<T> {
    return this.repository.findById(id, db);
  }

  list(query: ListQueryDto, db?: DbClient): Promise<Paginated<T>> {
    return this.repository.findPage(query, {}, db);
  }

  create(data: C, db?: DbClient): Promise<T> {
    return this.repository.create(data, db);
  }

  update(id: T[K], expectedVersion: number, data: Partial<U>, db?: DbClient): Promise<T> {
    return this.repository.update(id, expectedVersion, data, db);
  }
}
