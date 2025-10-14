import type {LogContext, LoggerConfig, LogLevel} from './logger.types';
import type {Request} from 'express';

/**
 * Core logger interface - abstraction for logging implementations
 * This interface allows swapping underlying logging libraries without changing application code
 */
export interface ILogger {
  /**
   * Log an informational message
   * @param message - The log message
   * @param context - Optional contextual data
   */
  info(message: string, context?: LogContext): void;
  info(context: LogContext, message: string): void;

  /**
   * Log an error message
   * @param message - The error message
   * @param error - Optional Error object
   * @param context - Optional contextual data
   */
  error(message: string, error?: Error, context?: LogContext): void;
  error(context: LogContext, message: string, error?: Error): void;

  /**
   * Log a warning message
   * @param message - The warning message
   * @param context - Optional contextual data
   */
  warn(message: string, context?: LogContext): void;
  warn(context: LogContext, message: string): void;

  /**
   * Log a debug message
   * @param message - The debug message
   * @param context - Optional contextual data
   */
  debug(message: string, context?: LogContext): void;
  debug(context: LogContext, message: string): void;

  /**
   * Log a trace message (most verbose)
   * @param message - The trace message
   * @param context - Optional contextual data
   */
  trace(message: string, context?: LogContext): void;
  trace(context: LogContext, message: string): void;

  /**
   * Log a fatal error message
   * @param message - The fatal error message
   * @param error - Optional Error object
   * @param context - Optional contextual data
   */
  fatal(message: string, error?: Error, context?: LogContext): void;
  fatal(context: LogContext, message: string, error?: Error): void;

  /**
   * Create a child logger with additional bound context
   * Child loggers inherit the parent's configuration but add persistent context
   * @param bindings - Context to bind to all child logger calls
   */
  child(bindings: LogContext): ILogger;

  /**
   * Get the current log level
   */
  getLevel(): LogLevel;

  /**
   * Set the log level dynamically
   * @param level - The new log level
   */
  setLevel(level: LogLevel): void;
}

/**
 * Factory interface for creating logger instances
 * Allows dependency injection and testing
 */
export interface ILoggerFactory {
  /**
   * Create a new logger instance
   * @param name - Optional name for the logger (e.g., module or service name)
   * @param config - Optional configuration override
   */
  createLogger(name?: string, config?: Partial<LoggerConfig>): ILogger;

  /**
   * Create a logger bound to an Express request
   * Automatically includes request context (correlation ID, user, etc.)
   * @param req - Express request object
   */
  createRequestLogger(req: Request): ILogger;

  /**
   * Get the global logger configuration
   */
  getConfig(): LoggerConfig;
}
