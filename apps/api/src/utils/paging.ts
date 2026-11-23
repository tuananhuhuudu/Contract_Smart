import type { ListQueryDto, PageMeta } from "../schemas/base.schema";

/**
 * One page of rows plus its metadata. Services return this from list methods; the response
 * interceptor turns it into { data: items, meta }.
 */
export class Paginated<T> {
  constructor(
    readonly items: T[],
    readonly meta: PageMeta,
  ) {}
}

/** Type guard used by the response interceptor. */
export function isPaginated(value: unknown): value is Paginated<unknown> {
  return value instanceof Paginated;
}

/** Prisma skip/take for a page; page and pageSize are already validated by ListQueryDto. */
export function toSkipTake(query: Pick<ListQueryDto, "page" | "pageSize">): { skip: number; take: number } {
  return { skip: (query.page - 1) * query.pageSize, take: query.pageSize };
}

export function pageMeta(query: Pick<ListQueryDto, "page" | "pageSize">, total: number): PageMeta {
  return {
    page: query.page,
    pageSize: query.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
  };
}
