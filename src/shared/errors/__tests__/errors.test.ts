import { StatusCodes } from 'http-status-codes';
import { AppError } from '../app-error';
import {
  NotFoundError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
} from '../http-errors';

describe('AppError', () => {
  it('should create an error with required fields', () => {
    const error = new AppError('Something failed', {
      statusCode: StatusCodes.BAD_REQUEST,
      code: 'BAD_REQUEST',
    });

    expect(error.message).toBe('Something failed');
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe('BAD_REQUEST');
    expect(error.isOperational).toBe(true);
    expect(error.details).toBeUndefined();
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(AppError);
  });

  it('should create an error with details', () => {
    const details = { field: 'email', reason: 'invalid' };
    const error = new AppError('Validation failed', {
      statusCode: 422,
      code: 'VALIDATION_ERROR',
      details,
    });

    expect(error.details).toEqual(details);
  });

  it('should serialize to JSON matching OpenAPI schema', () => {
    const error = new AppError('Not found', {
      statusCode: 404,
      code: 'NOT_FOUND',
      details: { id: '123' },
    });
    const json = error.toJSON();

    expect(json).toEqual({
      error: {
        code: 'NOT_FOUND',
        message: 'Not found',
        details: { id: '123' },
      },
    });
  });

  it('should serialize without details when not provided', () => {
    const error = new AppError('Server error', {
      statusCode: 500,
      code: 'INTERNAL_ERROR',
    });
    const json = error.toJSON();

    expect(json).toEqual({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Server error',
      },
    });
  });

  it('should capture stack trace', () => {
    const error = new AppError('test', { statusCode: 500, code: 'TEST' });
    expect(error.stack).toBeDefined();
  });

  it('should have correct name', () => {
    const error = new AppError('test', { statusCode: 500, code: 'TEST' });
    expect(error.name).toBe('AppError');
  });
});

describe('NotFoundError', () => {
  it('should use all defaults when called with no args', () => {
    const error = new NotFoundError();
    expect(error.message).toBe('Resource not found');
    expect(error.code).toBe('NOT_FOUND');
    expect(error.details).toBeUndefined();
  });

  it('should have 404 status and correct defaults', () => {
    const error = new NotFoundError('User not found');

    expect(error.statusCode).toBe(StatusCodes.NOT_FOUND);
    expect(error.code).toBe('NOT_FOUND');
    expect(error.message).toBe('User not found');
    expect(error).toBeInstanceOf(AppError);
  });

  it('should accept custom code and details', () => {
    const error = new NotFoundError('Order not found', 'ORDER_NOT_FOUND', { orderId: '1' });

    expect(error.code).toBe('ORDER_NOT_FOUND');
    expect(error.details).toEqual({ orderId: '1' });
  });
});

describe('ValidationError', () => {
  it('should use all defaults when called with no args', () => {
    const error = new ValidationError();
    expect(error.message).toBe('Validation failed');
    expect(error.code).toBe('VALIDATION_ERROR');
  });

  it('should have 422 status and correct defaults', () => {
    const error = new ValidationError('Invalid input');

    expect(error.statusCode).toBe(StatusCodes.UNPROCESSABLE_ENTITY);
    expect(error.code).toBe('VALIDATION_ERROR');
  });

  it('should accept field errors as details', () => {
    const details = [{ field: 'email', message: 'required' }];
    const error = new ValidationError('Validation failed', undefined, details);

    expect(error.details).toEqual(details);
  });
});

describe('UnauthorizedError', () => {
  it('should have 401 status and correct defaults', () => {
    const error = new UnauthorizedError();

    expect(error.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    expect(error.code).toBe('UNAUTHORIZED');
    expect(error.message).toBe('Authentication required');
  });
});

describe('ForbiddenError', () => {
  it('should have 403 status and correct defaults', () => {
    const error = new ForbiddenError();

    expect(error.statusCode).toBe(StatusCodes.FORBIDDEN);
    expect(error.code).toBe('FORBIDDEN');
    expect(error.message).toBe('Access denied');
  });
});

describe('ConflictError', () => {
  it('should use all defaults when called with no args', () => {
    const error = new ConflictError();
    expect(error.message).toBe('Resource already exists');
    expect(error.code).toBe('CONFLICT');
  });

  it('should have 409 status and correct defaults', () => {
    const error = new ConflictError('Email already exists');

    expect(error.statusCode).toBe(StatusCodes.CONFLICT);
    expect(error.code).toBe('CONFLICT');
    expect(error.message).toBe('Email already exists');
  });
});
