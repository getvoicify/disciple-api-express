/**
 * Log severity levels
 */
export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

/**
 * Additional context data to be included in log entries
 */
export type LogContext = Record<string, unknown>;

/**
 * Configuration for logger instances
 */
export interface LoggerConfig {
  /**
   * Minimum log level to output
   */
  level: LogLevel;

  /**
   * Enable pretty-printing for development
   */
  prettyPrint: boolean;

  /**
   * Paths to redact sensitive data (e.g., ['password', 'token', 'authorization'])
   */
  redactPaths: string[];

  /**
   * Current environment
   */
  environment: string;

  /**
   * Service/application name
   */
  name?: string;
}

/**
 * Metadata attached to log entries
 */
export interface LogMetadata {
  /**
   * Timestamp of the log entry
   */
  timestamp?: string;

  /**
   * Correlation ID for distributed tracing
   */
  correlationId?: string;

  /**
   * User ID if authenticated
   */
  userId?: string;

  /**
   * Additional custom metadata
   */
  [key: string]: unknown;
}