import type {Logger as PinoLogger} from 'pino';
import type {ILogger} from './logger.interface';
import type {LogContext, LogLevel} from './logger.types';

/**
 * Pino implementation of the ILogger interface
 * Wraps a Pino logger instance and provides a consistent API
 */
export class PinoLoggerImpl implements ILogger {
  constructor(private readonly pinoInstance: PinoLogger) {}

  /**
   * Helper method to handle overloaded log method signatures
   * Supports both (message, context?) and (context, message) patterns
   */
  private logWithOverloads(
    method: 'info' | 'warn' | 'debug' | 'trace',
    arg1: string | LogContext,
    arg2?: string | LogContext
  ): void {
    if (typeof arg1 === 'string') {
      // Pattern: method(message, context?)
      const message = arg1;
      const context = arg2 as LogContext | undefined;
      if (context) {
        this.pinoInstance[method](context, message);
      } else {
        this.pinoInstance[method](message);
      }
    } else {
      // Pattern: method(context, message)
      const context = arg1;
      const message = arg2 as string;
      this.pinoInstance[method](context, message);
    }
  }

  /**
   * Helper method for error/fatal logging with Error object support
   * Supports (message, error?, context?) and (context, message, error?) patterns
   */
  private logErrorWithOverloads(
    method: 'error' | 'fatal',
    arg1: string | LogContext,
    arg2?: Error | string,
    arg3?: LogContext | Error
  ): void {
    if (typeof arg1 === 'string') {
      // Pattern: method(message, error?, context?)
      const message = arg1;
      const error = arg2 as Error | undefined;
      const context = arg3 as LogContext | undefined;

      const logContext: LogContext = { ...context };
      if (error) {
        logContext.err = error;
      }

      if (Object.keys(logContext).length > 0) {
        this.pinoInstance[method](logContext, message);
      } else {
        this.pinoInstance[method](message);
      }
    } else {
      // Pattern: method(context, message, error?)
      const context = arg1;
      const message = arg2 as string;
      const error = arg3 as Error | undefined;

      const logContext: LogContext = { ...context };
      if (error) {
        logContext.err = error;
      }

      this.pinoInstance[method](logContext, message);
    }
  }

  info(message: string, context?: LogContext): void;
  info(context: LogContext, message: string): void;
  info(arg1: string | LogContext, arg2?: string | LogContext): void {
    this.logWithOverloads('info', arg1, arg2);
  }

  error(message: string, error?: Error, context?: LogContext): void;
  error(context: LogContext, message: string, error?: Error): void;
  error(arg1: string | LogContext, arg2?: Error | string, arg3?: LogContext | Error): void {
    this.logErrorWithOverloads('error', arg1, arg2, arg3);
  }

  warn(message: string, context?: LogContext): void;
  warn(context: LogContext, message: string): void;
  warn(arg1: string | LogContext, arg2?: string | LogContext): void {
    this.logWithOverloads('warn', arg1, arg2);
  }

  debug(message: string, context?: LogContext): void;
  debug(context: LogContext, message: string): void;
  debug(arg1: string | LogContext, arg2?: string | LogContext): void {
    this.logWithOverloads('debug', arg1, arg2);
  }

  trace(message: string, context?: LogContext): void;
  trace(context: LogContext, message: string): void;
  trace(arg1: string | LogContext, arg2?: string | LogContext): void {
    this.logWithOverloads('trace', arg1, arg2);
  }

  fatal(message: string, error?: Error, context?: LogContext): void;
  fatal(context: LogContext, message: string, error?: Error): void;
  fatal(arg1: string | LogContext, arg2?: Error | string, arg3?: LogContext | Error): void {
    this.logErrorWithOverloads('fatal', arg1, arg2, arg3);
  }

  child(bindings: LogContext): ILogger {
    const childPinoInstance = this.pinoInstance.child(bindings);
    return new PinoLoggerImpl(childPinoInstance);
  }

  getLevel(): LogLevel {
    return this.pinoInstance.level as LogLevel;
  }

  setLevel(level: LogLevel): void {
    this.pinoInstance.level = level;
  }
}
