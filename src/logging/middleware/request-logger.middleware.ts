import type {NextFunction, Request, Response} from 'express';
import type {ILogger, ILoggerFactory} from '../logger.interface';
import type {LogLevel} from '../logger.types';

/**
 * Configuration options for request logging middleware
 */
export interface RequestLoggerOptions {
  /**
   * Paths to exclude from logging (e.g., health checks)
   */
  excludePaths?: string[];
}

/**
 * Extends Express Request to include logger
 */
declare global {
  namespace Express {
    interface Request {
      log?: ILogger;
    }
  }
}

/**
 * Creates an Express middleware for automatic request/response logging
 * Attaches a logger instance to each request for use in downstream handlers
 *
 * @param factory - Logger factory for creating request-scoped loggers
 * @param options - Optional configuration
 * @returns Express middleware function
 */
export function createRequestLoggingMiddleware(
  factory: ILoggerFactory,
  options?: RequestLoggerOptions
): (req: Request, res: Response, next: NextFunction) => void {
  const excludePaths = options?.excludePaths || [];

  return (req: Request, res: Response, next: NextFunction): void => {
    // Skip logging for excluded paths (use req.path to exclude query strings)
    if (excludePaths.includes(req.path)) {
      return next();
    }

    try {
      // Create request-scoped logger
      const logger = factory.createRequestLogger(req);

      // Attach logger to request for downstream use
      req.log = logger;

      // Log incoming request
      logger.info(
        {
          method: req.method,
          url: req.url,
          userAgent: req.get('user-agent'),
          ip: req.ip || req.socket.remoteAddress,
        },
        'Incoming request'
      );

      // Track request start time
      const startTime = Date.now();

      // Log response when finished
      res.on('finish', () => {
        const responseTime = Date.now() - startTime;
        const statusCode = res.statusCode;

        const logContext = {
          statusCode,
          responseTime,
          method: req.method,
          url: req.url,
        };

        // Log based on status code
        if (statusCode >= 500) {
          logger.error(logContext, 'Request completed');
        } else if (statusCode >= 400) {
          logger.warn(logContext, 'Request completed');
        } else {
          logger.info(logContext, 'Request completed');
        }
      });

      next();
    } catch (error) {
      // Log error to console since structured logger failed
      console.error('Failed to create request logger:', error);

      // Provide fallback no-op logger to prevent undefined errors
      req.log = {
        trace: () => {},
        debug: () => {},
        info: () => {},
        warn: () => {},
        error: () => {},
        fatal: () => {},
        child: () => req.log!,
        getLevel: () => 'info' as LogLevel,
        setLevel: () => {},
      } as ILogger;

      next();
    }
  };
}
