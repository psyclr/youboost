import { ValidationError } from '../errors';

interface ZodLike<T> {
  safeParse: (data: unknown) => {
    success: boolean;
    data?: T;
    error?: { issues: unknown[] };
  };
}

function parse<T>(schema: ZodLike<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ValidationError('Validation failed', 'VALIDATION_ERROR', result.error?.issues);
  }
  return result.data as T;
}

export function validateBody<T>(schema: ZodLike<T>, body: unknown): T {
  return parse(schema, body);
}

export function validateQuery<T>(schema: ZodLike<T>, query: unknown): T {
  return parse(schema, query);
}

export function validateParams<T>(schema: ZodLike<T>, params: unknown): T {
  return parse(schema, params);
}
