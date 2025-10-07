import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {NextFunction, Request, Response} from 'express';
import {errorHandler, notFoundHandler} from './error-handler.middleware';
import {InternalServerError, NotFoundError, UnauthorizedError, ValidationError} from '../utils/errors';
import {ZodError} from 'zod';
import type {ILogger} from '../logging';

describe('Error Handler Middleware (with Logger)', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let nextFn: NextFunction;
  let mockLogger: ILogger;
  let jsonMock: ReturnType<typeof vi.fn>;
  let statusMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock logger
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      trace: vi.fn(),
      fatal: vi.fn(),
      child: vi.fn().mockReturnThis(),
      getLevel: vi.fn().mockReturnValue('info'),
      setLevel: vi.fn(),
    };

    // Mock request
    mockReq = {
      path: '/api/test',
      method: 'POST',
      log: mockLogger, // Request logger attached by middleware
    };

    // Mock response
    jsonMock = vi.fn();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock });
    mockRes = {
      status: statusMock,
      headersSent: false,
    };

    nextFn = vi.fn();
  });

  describe('Logging AppError instances', () => {
    it('should log operational AppError with context', () => {
      const error = new NotFoundError('User', '123');

      errorHandler(error, mockReq as Request, mockRes as Response, nextFn);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          message: error.message,
          statusCode: 404,
          path: '/api/test',
          method: 'POST',
        }),
        'Request error'
      );
    });

    it('should log non-operational AppError as error', () => {
      const error = new InternalServerError('Critical system failure');

      errorHandler(error, mockReq as Request, mockRes as Response, nextFn);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          message: error.message,
          statusCode: 500,
          isOperational: false,
        }),
        'Non-operational error occurred'
      );
    });

    it('should log ValidationError with validation details', () => {
      const validationErrors = {
        email: ['Invalid email format'],
        password: ['Password too short'],
      };
      const error = new ValidationError('Validation failed', validationErrors);

      errorHandler(error, mockReq as Request, mockRes as Response, nextFn);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          message: error.message,
          statusCode: 400,
          errors: validationErrors,
        }),
        'Request error'
      );
    });

    it('should include stack trace in development mode', () => {
      const originalEnv = process.env.NODE_ENV;
      try {
        process.env.NODE_ENV = 'development';
        const error = new NotFoundError('Resource');

        errorHandler(error, mockReq as Request, mockRes as Response, nextFn);

        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.objectContaining({
            stack: expect.any(String),
          }),
          'Request error'
        );
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });

    it('should not include stack trace in production mode', () => {
      const originalEnv = process.env.NODE_ENV;
      try {
        process.env.NODE_ENV = 'production';
        const error = new NotFoundError('Resource');

        errorHandler(error, mockReq as Request, mockRes as Response, nextFn);

        const logCall = (mockLogger.warn as any).mock.calls[0];
        expect(logCall[0]).not.toHaveProperty('stack');
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });
  });

  describe('Logging ZodError instances', () => {
    it('should log Zod validation errors with formatted errors', () => {
      const zodError = new ZodError([
        {
          code: 'invalid_type',
          expected: 'string',
          path: ['email'],
          message: 'Expected string, received number',
        },
      ]);

      errorHandler(zodError, mockReq as Request, mockRes as Response, nextFn);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 400,
          path: '/api/test',
          method: 'POST',
        }),
        'Validation error'
      );
    });
  });

  describe('Logging standard Error instances', () => {
    it('should log standard Error as error', () => {
      const error = new Error('Unexpected error');

      errorHandler(error, mockReq as Request, mockRes as Response, nextFn);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Unexpected error',
          path: '/api/test',
          method: 'POST',
        }),
        'Unhandled error'
      );
    });

    it('should include error stack in logs', () => {
      const error = new Error('System failure');

      errorHandler(error, mockReq as Request, mockRes as Response, nextFn);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          stack: expect.any(String),
        }),
        'Unhandled error'
      );
    });
  });

  describe('Logging unknown error types', () => {
    it('should log unknown error types safely', () => {
      const unknownError = { weird: 'object' };

      errorHandler(unknownError, mockReq as Request, mockRes as Response, nextFn);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          error: unknownError,
        }),
        'Unknown error type'
      );
    });
  });

  describe('Graceful handling without logger', () => {
    it('should not crash if request logger is missing', () => {
      delete mockReq.log;
      const error = new NotFoundError('User');

      expect(() => {
        errorHandler(error, mockReq as Request, mockRes as Response, nextFn);
      }).not.toThrow();

      expect(statusMock).toHaveBeenCalledWith(404);
    });

    it('should still send proper error response without logger', () => {
      delete mockReq.log;
      const error = new ValidationError('Bad input');

      errorHandler(error, mockReq as Request, mockRes as Response, nextFn);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Bad input',
        })
      );
    });
  });

  describe('Response already sent', () => {
    it('should call next if headers already sent', () => {
      mockRes.headersSent = true;
      const error = new Error('Too late');

      errorHandler(error, mockReq as Request, mockRes as Response, nextFn);

      expect(nextFn).toHaveBeenCalledWith(error);
      expect(mockLogger.error).not.toHaveBeenCalled();
    });
  });

  describe('Error severity levels', () => {
    it('should use warn for 4xx errors', () => {
      const error = new UnauthorizedError();

      errorHandler(error, mockReq as Request, mockRes as Response, nextFn);

      expect(mockLogger.warn).toHaveBeenCalled();
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should use error for 5xx errors', () => {
      const error = new InternalServerError('Server error');

      errorHandler(error, mockReq as Request, mockRes as Response, nextFn);

      expect(mockLogger.error).toHaveBeenCalled();
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });
  });
});

describe('Not Found Handler (with Logger)', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let nextFn: NextFunction;
  let mockLogger: ILogger;

  beforeEach(() => {
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      trace: vi.fn(),
      fatal: vi.fn(),
      child: vi.fn().mockReturnThis(),
      getLevel: vi.fn().mockReturnValue('info'),
      setLevel: vi.fn(),
    };

    mockReq = {
      originalUrl: '/api/nonexistent',
      log: mockLogger,
    };

    mockRes = {};
    nextFn = vi.fn();
  });

  it('should log 404 as warning', () => {
    notFoundHandler(mockReq as Request, mockRes as Response, nextFn);

    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/api/nonexistent',
      }),
      'Route not found'
    );
  });

  it('should pass NotFoundError to next', () => {
    notFoundHandler(mockReq as Request, mockRes as Response, nextFn);

    expect(nextFn).toHaveBeenCalledWith(expect.any(NotFoundError));
  });

  it('should work without logger', () => {
    delete mockReq.log;

    expect(() => {
      notFoundHandler(mockReq as Request, mockRes as Response, nextFn);
    }).not.toThrow();

    expect(nextFn).toHaveBeenCalledWith(expect.any(NotFoundError));
  });
});
