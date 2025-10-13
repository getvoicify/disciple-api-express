/**
 * Logging module - Production-ready structured logging with abstraction
 *
 * This module provides a logging abstraction that allows swapping implementations
 * without changing application code. Current implementation uses Pino for
 * high-performance JSON logging.
 */

// Export interfaces for dependency injection
export type { ILogger, ILoggerFactory } from './logger.interface';
export type { LogLevel, LogContext, LoggerConfig, LogMetadata } from './logger.types';

// Export concrete implementations
export { PinoLoggerImpl } from './pino-logger.impl';
export { PinoLoggerFactory } from './logger.factory';

// Export middleware
export { createRequestLoggingMiddleware } from './middleware/request-logger.middleware';
export type { RequestLoggerOptions } from './middleware/request-logger.middleware';

// Create and export a singleton factory instance for convenience
import {PinoLoggerFactory} from './logger.factory';

export const loggerFactory = new PinoLoggerFactory();

// Export a default logger instance for quick usage
export const logger = loggerFactory.createLogger();
