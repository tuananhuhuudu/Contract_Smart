import {
  BadRequestException,
  ConflictException,
  MethodNotAllowedException,
  NotFoundException,
} from "@nestjs/common";
import type {
  DataSource,
  DeepPartial,
  EntityManager,
  EntityTarget,
  FindOptionsOrder,
  FindOptionsWhere,
  ObjectLiteral,
  Repository,
} from "typeorm";
import type { QueryDeepPartialEntity } from "typeorm/query-builder/QueryPartialEntity";
import type { ListQueryDto } from "../schemas/base.schema";
import { pageMeta, Paginated, toSkipTake } from "../utils/paging";

/** Upper bound of findMany, so no call loads a whole large table by accident. */
export const MAX_FIND_MANY = 1000;

/**
 * Drops the fields a client did not send. Validated DTOs keep optional fields as undefined, and
 * spreading them over a stored row would erase its values.
 */
export function definedOnly<T extends object>(data: T): Partial<T> {
  return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined)) as Partial<T>;
}

/** Rows to match, by property name (TypeORM maps them to columns). */
export type Where<T> = FindOptionsWhere<T>;

/**
 * Generic repository (BaseRepository of the chatbot), adapted for this project:
 *  - never commits by itself: every method takes an optional EntityManager `db`, so a service can
 *    run several calls inside one `dataSource.transaction(...)`;
 *  - sorting only by the whitelisted `sortableFields`;
 *  - updates and deletes check `version` (optimistic locking): a stale version gives 409;
 *  - delete is off by default (405); a table that may lose rows sets `allowDelete = true`.
 *
 * T is the entity class (it extends BaseModel, so it has `version`), K the name of its primary
 * key property (for example "code").
 */
export abstract class BaseRepository<T extends ObjectLiteral, K extends keyof T & string> {
  /** The entity class, for example ContractType. */
  protected abstract readonly entity: EntityTarget<T>;
  /** Name of the primary key property. */
  protected abstract readonly idField: K;
  /** Properties a client may sort by; anything else is rejected with 400. */
  protected abstract readonly sortableFields: readonly (keyof T & string)[];
  /** Sort used when the client gives none. */
  protected abstract readonly defaultSort: keyof T & string;
  /** Whether rows of this table may be deleted at all. */
  protected readonly allowDelete: boolean = false;

  constructor(protected readonly dataSource: DataSource) {}

  /** The TypeORM repository on the shared connection or on a running transaction. */
  protected repo(db?: EntityManager): Repository<T> {
    return (db ?? this.dataSource.manager).getRepository(this.entity);
  }

  // Building a where/order object from a property name needs a cast: TypeScript cannot tie a
  // computed key to the entity's property types.
  private byId(id: T[K]): Where<T> {
    return { [this.idField]: id } as unknown as Where<T>;
  }

  /** Row by primary key, or null. */
  findByIdOptional(id: T[K], db?: EntityManager): Promise<T | null> {
    return this.repo(db).findOneBy(this.byId(id));
  }

  /** Row by primary key; 404 when it does not exist. */
  async findById(id: T[K], db?: EntityManager): Promise<T> {
    const row = await this.findByIdOptional(id, db);
    if (!row) throw new NotFoundException(`${this.entityName} ${String(id)} not found`);
    return row;
  }

  /** One page of rows matching `where`, sorted by a whitelisted property. */
  async findPage(query: ListQueryDto, where: Where<T> = {}, db?: EntityManager): Promise<Paginated<T>> {
    const order = { [this.sortField(query.sortBy)]: query.order } as unknown as FindOptionsOrder<T>;
    const [items, total] = await this.repo(db).findAndCount({ where, order, ...toSkipTake(query) });
    return new Paginated(items, pageMeta(query, total));
  }

  /** First row matching `where` (for example a user by email), or null. */
  findOne(where: Where<T>, db?: EntityManager): Promise<T | null> {
    return this.repo(db).findOneBy(where);
  }

  /** Every row matching `where`, sorted by the default sort, at most `limit` rows. */
  findMany(where: Where<T> = {}, limit = MAX_FIND_MANY, db?: EntityManager): Promise<T[]> {
    const take = Math.min(Math.max(1, limit), MAX_FIND_MANY);
    const order = { [this.defaultSort]: "asc" } as unknown as FindOptionsOrder<T>;
    return this.repo(db).find({ where, order, take });
  }

  count(where: Where<T> = {}, db?: EntityManager): Promise<number> {
    return this.repo(db).countBy(where);
  }

  /** True when at least one row matches, for example to refuse a duplicate before creating. */
  async exists(where: Where<T>, db?: EntityManager): Promise<boolean> {
    return (await this.count(where, db)) > 0;
  }

  /**
   * Inserts a new row; an existing key is a 409 (DUPLICATE_RECORD), never a silent overwrite
   * (TypeORM's save() would update the existing row instead).
   */
  async create(data: DeepPartial<T>, db?: EntityManager): Promise<T> {
    const repo = this.repo(db);
    const entity = repo.create(data);
    await repo.insert(entity as QueryDeepPartialEntity<T>);
    // Read the row back: the caller gets what the database stored ("516.00", defaults), not its input.
    return this.findById(entity[this.idField], db);
  }

  /** Inserts several rows in one statement (seed data, all milestones of a contract). */
  async createMany(data: DeepPartial<T>[], db?: EntityManager): Promise<number> {
    if (data.length === 0) return 0;
    await this.repo(db).insert(data as QueryDeepPartialEntity<T>[]);
    return data.length;
  }

  /**
   * Updates the row only if it still has `expectedVersion`; TypeORM adds 1 to the version.
   * 404 when the row is gone, 409 when someone else changed it first.
   */
  async update(id: T[K], expectedVersion: number, data: Partial<T>, db?: EntityManager): Promise<T> {
    const where = { ...this.byId(id), version: expectedVersion } as Where<T>;
    const { affected } = await this.repo(db).update(where, definedOnly(data) as QueryDeepPartialEntity<T>);
    if (!affected) {
      await this.findById(id, db); // 404 if missing
      throw new ConflictException("VERSION_CONFLICT: the record was changed by someone else; reload and retry");
    }
    return this.findById(id, db);
  }

  /**
   * Deletes the row only if it still has `expectedVersion`. 405 when the table does not allow
   * deleting, 404 when the row is gone, 409 when someone else changed it first.
   */
  async delete(id: T[K], expectedVersion: number, db?: EntityManager): Promise<void> {
    if (!this.allowDelete) throw new MethodNotAllowedException(`${this.entityName} cannot be deleted`);
    const where = { ...this.byId(id), version: expectedVersion } as Where<T>;
    const { affected } = await this.repo(db).delete(where);
    if (!affected) {
      await this.findById(id, db); // 404 if missing
      throw new ConflictException("VERSION_CONFLICT: the record was changed by someone else; reload and retry");
    }
  }

  /** Name used in error messages, for example "ContractType" for ContractTypeRepository. */
  protected get entityName(): string {
    return this.constructor.name.replace(/Repository$/, "");
  }

  private sortField(requested: string | undefined): keyof T & string {
    if (requested === undefined) return this.defaultSort;
    const allowed = this.sortableFields.find((field) => field === requested);
    if (!allowed) throw new BadRequestException(`sortBy must be one of: ${this.sortableFields.join(", ")}`);
    return allowed;
  }
}
