interface AppErrorOptions {
  statusCode: number;
  code: string;
  details?: unknown;
}

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;
  public readonly details?: unknown;

  constructor(message: string, options: AppErrorOptions) {
    super(message);
    this.name = 'AppError';
    this.statusCode = options.statusCode;
    this.code = options.code;
    this.isOperational = true;
    this.details = options.details;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON(): { error: { code: string; message: string; details?: unknown } } {
    const body: { code: string; message: string; details?: unknown } = {
      code: this.code,
      message: this.message,
    };
    if (this.details !== undefined) {
      body.details = this.details;
    }
    return { error: body };
  }
}
