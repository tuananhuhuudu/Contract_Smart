import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from "@nestjs/common";
import { QueryFailedError } from "typeorm";
import type { Response } from "express";
import type { ApiError } from "../schemas/base.schema";
import { requestIdOf, type RequestWithId } from "./response.interceptor";

/** PostgreSQL errors that are the client's fault (SQLSTATE codes), with the HTTP status they deserve. */
const DATABASE_STATUS: Record<string, { status: HttpStatus; message: string }> = {
  "23505": { status: HttpStatus.CONFLICT, message: "DUPLICATE_RECORD" }, // unique_violation
  "23503": { status: HttpStatus.CONFLICT, message: "REFERENCED_RECORD_CONFLICT" }, // foreign_key_violation
  "23514": { status: HttpStatus.BAD_REQUEST, message: "CONSTRAINT_VIOLATION" }, // check_violation
};

/** SQLSTATE code of a failed query, if the database gave one. */
function sqlState(exception: unknown): string | undefined {
  if (!(exception instanceof QueryFailedError)) return undefined;
  const code = (exception.driverError as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
}

/**
 * One error format for every failure (exception_handler.py of the chatbot). Unexpected errors
 * become 500 and are logged; their details never reach the client.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger("Exceptions");

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const requestId = requestIdOf(http.getRequest<RequestWithId>());
    let statusCode: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = "INTERNAL_ERROR";

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const body = exception.getResponse();
      const raw = typeof body === "string" ? body : (body as { message?: string | string[] }).message;
      message = Array.isArray(raw) ? raw.join("; ") : (raw ?? exception.message);
    } else if (sqlState(exception) === "23514" && /^[A-Z_]+:/.test((exception as Error).message)) {
      statusCode = HttpStatus.CONFLICT;
      message = (exception as Error).message;
    } else if (DATABASE_STATUS[sqlState(exception) ?? ""]) {
      const mapped = DATABASE_STATUS[sqlState(exception)!]!;
      statusCode = mapped.status;
      message = mapped.message;
    } else {
      this.logger.error(exception instanceof Error ? (exception.stack ?? exception.message) : String(exception));
    }

    const error: ApiError = {
      success: false,
      statusCode,
      code: HttpStatus[statusCode] ?? "ERROR",
      message,
      requestId,
    };
    http.getResponse<Response>().status(statusCode).json(error);
  }
}
