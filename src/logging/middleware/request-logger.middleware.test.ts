import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {NextFunction, Request, Response} from 'express';
import {createRequestLoggingMiddleware} from './request-logger.middleware';
import type {ILogger, ILoggerFactory} from '../logger.interface';

describe('Request Logging Middleware', () => {
  let mockFactory: ILoggerFactory;
  let mockLogger: ILogger;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let nextFn: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock logger
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

    // Create mock factory that returns mockLogger
    mockFactory = {
      createLogger: vi.fn().mockReturnValue(mockLogger),
      createRequestLogger: vi.fn().mockReturnValue(mockLogger),
      getConfig: vi.fn().mockReturnValue({
        level: 'info',
        prettyPrint: false,
        redactPaths: [],
        environment: 'test',
      }),
    };

    // Create mock request
    mockReq = {
      method: 'GET',
      url: '/api/users',
      path: '/api/users',
      headers: {},
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' } as any,
      get: vi.fn((header: string) => {
        if (header === 'user-agent') return 'test-agent';
        return undefined;
      }),
    } as unknown as Request;

    // Create mock response
    mockRes = {
      statusCode: 200,
      on: vi.fn(),
      end: vi.fn(),
    };

    nextFn = vi.fn();
  });

  describe('Middleware Creation', () => {
    it('should create middleware function when factory provided', () => {
      const middleware = createRequestLoggingMiddleware(mockFactory);

      expect(middleware).toBeDefined();
      expect(typeof middleware).toBe('function');
    });

    it('should attach logger to request object', () => {
      const middleware = createRequestLoggingMiddleware(mockFactory);

      middleware(mockReq as Request, mockRes as Response, nextFn);

      expect((mockReq as any).log).toBeDefined();
      expect(mockFactory.createRequestLogger).toHaveBeenCalledWith(mockReq);
    });

    it('should call next() after attaching logger', () => {
      const middleware = createRequestLoggingMiddleware(mockFactory);

      middleware(mockReq as Request, mockRes as Response, nextFn);

      expect(nextFn).toHaveBeenCalled();
      expect(nextFn).toHaveBeenCalledWith();
    });
  });

  describe('Request Logging', () => {
    it('should log incoming request', () => {
      const middleware = createRequestLoggingMiddleware(mockFactory);

      middleware(mockReq as Request, mockRes as Response, nextFn);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'GET',
          url: '/api/users',
        }),
        'Incoming request'
      );
    });

    it('should include request headers in log', () => {
      mockReq.headers = { 'user-agent': 'test-agent' };
      const middleware = createRequestLoggingMiddleware(mockFactory);

      middleware(mockReq as Request, mockRes as Response, nextFn);

      expect(mockLogger.info).toHaveBeenCalled();
    });

    it('should handle requests without headers gracefully', () => {
      delete mockReq.headers;
      const middleware = createRequestLoggingMiddleware(mockFactory);

      expect(() => {
        middleware(mockReq as Request, mockRes as Response, nextFn);
      }).not.toThrow();
    });
  });

  describe('Response Logging', () => {
    it('should log response on finish event', () => {
      let finishHandler: Function | undefined;
      mockRes.on = vi.fn((event: string, handler: Function) => {
        if (event === 'finish') {
          finishHandler = handler;
        }
        return mockRes as Response;
      });

      const middleware = createRequestLoggingMiddleware(mockFactory);
      middleware(mockReq as Request, mockRes as Response, nextFn);

      // Simulate response finish
      expect(finishHandler).toBeDefined();
      finishHandler!();

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 200,
        }),
        'Request completed'
      );
    });

    it('should include response time in log', () => {
      let finishHandler: Function | undefined;
      mockRes.on = vi.fn((event: string, handler: Function) => {
        if (event === 'finish') {
          finishHandler = handler;
        }
        return mockRes as Response;
      });

      const middleware = createRequestLoggingMiddleware(mockFactory);
      middleware(mockReq as Request, mockRes as Response, nextFn);

      // Wait a bit then trigger finish
      finishHandler!();

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          responseTime: expect.any(Number),
        }),
        'Request completed'
      );
    });

    it('should log 4xx responses as warnings', () => {
      mockRes.statusCode = 404;
      let finishHandler: Function | undefined;
      mockRes.on = vi.fn((event: string, handler: Function) => {
        if (event === 'finish') {
          finishHandler = handler;
        }
        return mockRes as Response;
      });

      const middleware = createRequestLoggingMiddleware(mockFactory);
      middleware(mockReq as Request, mockRes as Response, nextFn);

      finishHandler!();

      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should log 5xx responses as errors', () => {
      mockRes.statusCode = 500;
      let finishHandler: Function | undefined;
      mockRes.on = vi.fn((event: string, handler: Function) => {
        if (event === 'finish') {
          finishHandler = handler;
        }
        return mockRes as Response;
      });

      const middleware = createRequestLoggingMiddleware(mockFactory);
      middleware(mockReq as Request, mockRes as Response, nextFn);

      finishHandler!();

      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should log 2xx and 3xx responses as info', () => {
      mockRes.statusCode = 201;
      let finishHandler: Function | undefined;
      mockRes.on = vi.fn((event: string, handler: Function) => {
        if (event === 'finish') {
          finishHandler = handler;
        }
        return mockRes as Response;
      });

      const middleware = createRequestLoggingMiddleware(mockFactory);
      middleware(mockReq as Request, mockRes as Response, nextFn);

      finishHandler!();

      // Should be logged as info (at least 2 calls: incoming + completed)
      expect(mockLogger.info).toHaveBeenCalledTimes(2);
    });
  });

  describe('Error Handling', () => {
    it('should handle errors during logger creation gracefully', () => {
      mockFactory.createRequestLogger = vi.fn().mockImplementation(() => {
        throw new Error('Logger creation failed');
      });

      const middleware = createRequestLoggingMiddleware(mockFactory);

      expect(() => {
        middleware(mockReq as Request, mockRes as Response, nextFn);
      }).not.toThrow();

      // Should call next() to continue request flow
      expect(nextFn).toHaveBeenCalledWith();

      // Should provide a no-op logger to prevent undefined errors
      expect((mockReq as any).log).toBeDefined();
      expect(typeof (mockReq as any).log.info).toBe('function');
    });
  });

  describe('Request Context', () => {
    it('should make logger available on request object', () => {
      const middleware = createRequestLoggingMiddleware(mockFactory);

      middleware(mockReq as Request, mockRes as Response, nextFn);

      expect((mockReq as any).log).toBe(mockLogger);
    });

    it('should allow downstream handlers to use request logger', () => {
      const middleware = createRequestLoggingMiddleware(mockFactory);

      middleware(mockReq as Request, mockRes as Response, nextFn);

      // Simulate downstream handler using logger
      const reqLogger = (mockReq as any).log as ILogger;
      reqLogger.info('Downstream log');

      expect(mockLogger.info).toHaveBeenCalledWith('Downstream log');
    });
  });

  describe('Configuration Options', () => {
    it('should support excluding specific paths from logging', () => {
      const middleware = createRequestLoggingMiddleware(mockFactory, {
        excludePaths: ['/health', '/metrics'],
      });

      // Create a new mock request with excluded path
      const excludedReq = {
        ...mockReq,
        url: '/health',
        path: '/health',
      } as Request;

      middleware(excludedReq, mockRes as Response, nextFn);

      // Should skip logging for excluded paths
      expect(nextFn).toHaveBeenCalled();
      expect(mockLogger.info).not.toHaveBeenCalled();
      expect(mockLogger.debug).not.toHaveBeenCalled();
    });
  });
});
