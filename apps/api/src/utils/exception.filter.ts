import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { Response } from "express";
import type { ApiError } from "../schemas/base.schema";
import { requestIdOf, type RequestWithId } from "./response.interceptor";

/** Database errors that are the client's fault, with the HTTP status they deserve. */
const PRISMA_STATUS: Record<string, { status: HttpStatus; message: string }> = {
  P2002: { status: HttpStatus.CONFLICT, message: "DUPLICATE_RECORD" },
  P2003: { status: HttpStatus.BAD_REQUEST, message: "REFERENCED_RECORD_NOT_FOUND" },
  P2025: { status: HttpStatus.NOT_FOUND, message: "RECORD_NOT_FOUND" },
};

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
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError && PRISMA_STATUS[exception.code]) {
      const mapped = PRISMA_STATUS[exception.code]!;
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
