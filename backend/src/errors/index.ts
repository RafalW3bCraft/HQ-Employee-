export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode = 500, code = 'INTERNAL_ERROR', details?: unknown) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON(requestId?: string) {
    return {
      error: {
        code: this.code,
        message: this.message,
        requestId,
        timestamp: new Date().toISOString(),
        ...(this.details !== undefined ? { details: this.details } : {})
      }
    };
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Bad request', details?: unknown) {
    super(message, 400, 'BAD_REQUEST', details);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed', details?: unknown) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource', id?: string) {
    super(id ? `${resource} with id '${id}' not found` : `${resource} not found`, 404, 'NOT_FOUND');
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized access') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden access') {
    super(message, 403, 'FORBIDDEN');
  }
}

export class PolicyDeniedError extends AppError {
  constructor(action: string, reason: string) {
    super(`Action '${action}' blocked by policy: ${reason}`, 403, 'POLICY_DENIED', { action, reason });
  }
}

export class ApprovalRequiredError extends AppError {
  constructor(action: string, approvalId: string) {
    super(`Action '${action}' requires human approval`, 202, 'APPROVAL_REQUIRED', { action, approvalId });
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource conflict') {
    super(message, 409, 'CONFLICT');
  }
}

export class CalendarOperationError extends AppError {
  constructor(message = 'Calendar service synchronization failed', details?: unknown) {
    super(message, 502, 'CALENDAR_OPERATION_FAILED', details);
  }
}
