import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import { EntityNotFoundError, QueryFailedError } from 'typeorm';

/**
 * Every error leaves the API in the same shape:
 *   { success: false, statusCode, error, message, path, timestamp, requestId }
 * Expected errors (validation, not found, conflicts) are passed through.
 * Database errors are translated into friendly messages.
 * Anything unexpected becomes a 500 with no internal details, and is logged
 * with the request id so it can be traced in the server logs.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Errors');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request & { id?: string }>();
    if (res.headersSent) return;

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Something went wrong on our side. Please try again.';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      message = typeof body === 'string' ? body : ((body as { message?: string | string[] }).message ?? exception.message);
    } else if (exception instanceof EntityNotFoundError) {
      status = HttpStatus.NOT_FOUND;
      message = 'Not found';
    } else if (exception instanceof QueryFailedError) {
      const code = (exception as QueryFailedError & { driverError?: { code?: string } }).driverError?.code;
      if (code === '23505') {
        status = HttpStatus.CONFLICT;
        message = 'This record already exists.';
      } else if (code === '23503') {
        status = HttpStatus.CONFLICT;
        message = 'This record is linked to other data and cannot be changed this way.';
      } else if (code === '23514') {
        status = HttpStatus.BAD_REQUEST;
        message = 'A value is outside the allowed range (for example a negative amount).';
      } else if (code === '22P02' || code === '22007' || code === '22003') {
        status = HttpStatus.BAD_REQUEST;
        message = 'One of the values has an invalid format.';
      } else if (code === '57014') {
        status = HttpStatus.SERVICE_UNAVAILABLE;
        message = 'The request took too long. Please try again.';
      }
    } else if ((exception as { type?: string })?.type === 'entity.too.large') {
      status = HttpStatus.PAYLOAD_TOO_LARGE;
      message = 'The request is too large.';
    }

    if (status >= 500) {
      this.logger.error(
        { err: exception, requestId: req.id, path: req.url, method: req.method },
        exception instanceof Error ? exception.message : 'Unknown error',
      );
    }

    res.status(status).json({
      success: false,
      statusCode: status,
      error: (HttpStatus[status] ?? 'Error')
        .replace(/_/g, ' ')
        .toLowerCase()
        .replace(/(^|\s)\S/g, (c) => c.toUpperCase()),
      message,
      path: req.originalUrl ?? req.url,
      timestamp: new Date().toISOString(),
      requestId: req.id,
    });
  }
}
