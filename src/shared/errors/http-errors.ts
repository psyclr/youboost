import { StatusCodes } from 'http-status-codes';
import { AppError } from './app-error';

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found', code = 'NOT_FOUND', details?: unknown) {
    super(message, { statusCode: StatusCodes.NOT_FOUND, code, details });
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed', code = 'VALIDATION_ERROR', details?: unknown) {
    super(message, { statusCode: StatusCodes.UNPROCESSABLE_ENTITY, code, details });
    this.name = 'ValidationError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required', code = 'UNAUTHORIZED', details?: unknown) {
    super(message, { statusCode: StatusCodes.UNAUTHORIZED, code, details });
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Access denied', code = 'FORBIDDEN', details?: unknown) {
    super(message, { statusCode: StatusCodes.FORBIDDEN, code, details });
    this.name = 'ForbiddenError';
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource already exists', code = 'CONFLICT', details?: unknown) {
    super(message, { statusCode: StatusCodes.CONFLICT, code, details });
    this.name = 'ConflictError';
  }
}
