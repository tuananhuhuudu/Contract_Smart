import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export const MAX_PAGE_SIZE = 100;
export const SORT_ORDERS = ["asc", "desc"] as const;
export type SortOrder = (typeof SORT_ORDERS)[number];

/**
 * Query string of every list endpoint: ?page=1&pageSize=20&sortBy=createdAt&order=desc
 * (PaginationParams + SortParams of the chatbot in one DTO). The repository checks that
 * sortBy is one of its sortable fields.
 */
export class ListQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  pageSize: number = 20;

  @IsOptional()
  @IsString()
  sortBy?: string;

  @IsOptional()
  @IsIn(SORT_ORDERS)
  order: SortOrder = "desc";
}

/** Page information returned next to a list (MetadataResponse of the chatbot). */
export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/** Envelope of every successful response (DataResponse of the chatbot). */
export interface ApiResponse<T> {
  success: true;
  data: T;
  meta?: PageMeta;
  requestId: string;
}

/** Envelope of every error: one format for 400, 401, 403, 404, 409 and 500. */
export interface ApiError {
  success: false;
  statusCode: number;
  code: string;
  message: string;
  requestId: string;
}
