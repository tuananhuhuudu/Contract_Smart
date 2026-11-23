import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import type { DbClient } from "../core/prisma.service";
import type { ListQueryDto } from "../schemas/base.schema";
import { pageMeta, Paginated, toSkipTake } from "../utils/paging";

type Where = Record<string, unknown>;

/**
 * The part of a Prisma model delegate (prisma.contract, prisma.user, ...) the base repository
 * uses. Each subclass returns its delegate through `delegate()`.
 */
export interface ModelDelegate<T> {
  findUnique(args: { where: Where }): Promise<T | null>;
  findMany(args: { where?: Where; orderBy?: Where; skip?: number; take?: number }): Promise<T[]>;
  count(args?: { where?: Where }): Promise<number>;
  create(args: { data: unknown }): Promise<T>;
  updateMany(args: { where: Where; data: unknown }): Promise<{ count: number }>;
}

/**
 * Generic repository (BaseRepository of the chatbot), adapted for this project:
 *  - never commits by itself: every method takes an optional transaction client `db`;
 *  - sorting only by the whitelisted `sortableFields`;
 *  - updates check `version` (optimistic locking): a stale version gives 409, not a lost update;
 *  - no generic delete: events and the audit log are append-only, Data Pack rows stay as given.
 *
 * T is the row type, K the name of its primary key field (for example "contractId"),
 * C the create input and U the update input of the model.
 */
export abstract class BaseRepository<T, K extends keyof T & string, C, U> {
  /** Name of the primary key field. */
  protected abstract readonly idField: K;
  /** Fields a client may sort by; anything else is rejected with 400. */
  protected abstract readonly sortableFields: readonly (keyof T & string)[];
  /** Sort used when the client gives none. */
  protected abstract readonly defaultSort: keyof T & string;
  /** Name of the version field, or null when the table has no optimistic lock. */
  protected readonly versionField: (keyof T & string) | null = "version" as keyof T & string;

  constructor(protected readonly prisma: DbClient) {}

  /** The Prisma delegate of this model on the given client (the shared one or a transaction). */
  protected abstract delegate(db: DbClient): ModelDelegate<T>;

  /** Row by primary key, or null. */
  findByIdOptional(id: T[K], db: DbClient = this.prisma): Promise<T | null> {
    return this.delegate(db).findUnique({ where: { [this.idField]: id } });
  }

  /** Row by primary key; 404 when it does not exist. */
  async findById(id: T[K], db: DbClient = this.prisma): Promise<T> {
    const row = await this.findByIdOptional(id, db);
    if (!row) throw new NotFoundException(`${this.constructor.name.replace("Repository", "")} ${String(id)} not found`);
    return row;
  }

  /** One page of rows matching `where`, sorted by a whitelisted field. */
  async findPage(query: ListQueryDto, where: Where = {}, db: DbClient = this.prisma): Promise<Paginated<T>> {
    const sortBy = this.sortField(query.sortBy);
    const delegate = this.delegate(db);
    const [items, total] = await Promise.all([
      delegate.findMany({ where, orderBy: { [sortBy]: query.order }, ...toSkipTake(query) }),
      delegate.count({ where }),
    ]);
    return new Paginated(items, pageMeta(query, total));
  }

  create(data: C, db: DbClient = this.prisma): Promise<T> {
    return this.delegate(db).create({ data });
  }

  /**
   * Updates the row only if it still has `expectedVersion`, and bumps the version.
   * 404 when the row is gone, 409 when someone else changed it first.
   */
  async update(id: T[K], expectedVersion: number, data: Partial<U>, db: DbClient = this.prisma): Promise<T> {
    const delegate = this.delegate(db);
    const where: Where = { [this.idField]: id };
    const changes: Record<string, unknown> = { ...data };
    if (this.versionField) {
      where[this.versionField] = expectedVersion;
      changes[this.versionField] = { increment: 1 };
    }
    const { count } = await delegate.updateMany({ where, data: changes });
    if (count === 0) {
      await this.findById(id, db); // 404 if missing
      throw new ConflictException("VERSION_CONFLICT: the record was changed by someone else; reload and retry");
    }
    return this.findById(id, db);
  }

  private sortField(requested: string | undefined): keyof T & string {
    if (requested === undefined) return this.defaultSort;
    const allowed = this.sortableFields.find((field) => field === requested);
    if (!allowed) throw new BadRequestException(`sortBy must be one of: ${this.sortableFields.join(", ")}`);
    return allowed;
  }
}
