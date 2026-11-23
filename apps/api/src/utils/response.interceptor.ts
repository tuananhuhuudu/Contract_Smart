import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { Request } from "express";
import { map, type Observable } from "rxjs";
import type { ApiResponse } from "../schemas/base.schema";
import { isPaginated } from "./paging";

export type RequestWithId = Request & { requestId?: string };

/** Gives the request an id (also used by the exception filter) and returns it. */
export function requestIdOf(request: RequestWithId): string {
  return (request.requestId ??= randomUUID());
}

/**
 * Wraps every successful response as { success, data, meta?, requestId } (DataResponse of the
 * chatbot, applied once for all controllers instead of in each handler).
 */
@Injectable()
export class ResponseInterceptor implements NestInterceptor<unknown, ApiResponse<unknown>> {
  intercept(context: ExecutionContext, next: CallHandler<unknown>): Observable<ApiResponse<unknown>> {
    const requestId = requestIdOf(context.switchToHttp().getRequest<RequestWithId>());
    return next.handle().pipe(
      map((result) =>
        isPaginated(result)
          ? { success: true as const, data: result.items, meta: result.meta, requestId }
          : { success: true as const, data: result, requestId },
      ),
    );
  }
}
