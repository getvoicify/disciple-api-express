import pino from 'pino';
import {randomUUID} from 'crypto';
import type {Request} from 'express';
import type {ILogger, ILoggerFactory} from './logger.interface';
import type {LoggerConfig, LogLevel} from './logger.types';
import {PinoLoggerImpl} from './pino-logger.impl';

/**
 * Factory for creating Pino-based logger instances
 * Implements dependency injection pattern for easy testing and swapping
 */
export class PinoLoggerFactory implements ILoggerFactory {
  private readonly config: LoggerConfig;

  constructor(configOverride?: Partial<LoggerConfig>) {
    this.config = this.buildConfig(configOverride);
  }

  /**
   * Build logger configuration from environment and overrides
   */
  private buildConfig(override?: Partial<LoggerConfig>): LoggerConfig {
    const nodeEnv = process.env.NODE_ENV || 'development';

    // Validate LOG_LEVEL environment variable
    const envLogLevel = process.env.LOG_LEVEL;
    const validLevels: LogLevel[] = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'];
    const logLevel = (envLogLevel && validLevels.includes(envLogLevel as LogLevel))
      ? (envLogLevel as LogLevel)
      : 'info';

    const baseConfig: LoggerConfig = {
      level: logLevel,
      prettyPrint: nodeEnv === 'development',
      redactPaths: [
        'password',
        'token',
        'authorization',
        'secret',
        'apiKey',
        'api_key',
        'accessToken',
        'refreshToken',
        'req.headers.authorization',
        'req.headers.cookie',
      ],
      environment: nodeEnv,
      name: 'disciple-api',
    };

    return { ...baseConfig, ...override };
  }

  /**
   * Create base Pino instance with configured options
   */
  private createPinoInstance(name?: string, configOverride?: Partial<LoggerConfig>): pino.Logger {
    const config = configOverride ? { ...this.config, ...configOverride } : this.config;

    const pinoOptions: pino.LoggerOptions = {
      level: config.level,
      redact: {
        paths: config.redactPaths,
        censor: '[REDACTED]',
      },
      serializers: {
        err: pino.stdSerializers.err,
        req: pino.stdSerializers.req,
        res: pino.stdSerializers.res,
      },
      base: {
        pid: process.pid,
        hostname: require('os').hostname(),
        environment: config.environment,
      },
    };

    // Add name to base if provided
    if (name || config.name) {
      pinoOptions.base = {
        ...pinoOptions.base,
        name: name || config.name,
      };
    }

    // Configure transport for pretty printing in development
    if (config.prettyPrint) {
      return pino({
        ...pinoOptions,
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:mm:ss o',
            ignore: 'pid,hostname',
          },
        },
      });
    }

    return pino(pinoOptions);
  }

  createLogger(name?: string, config?: Partial<LoggerConfig>): ILogger {
    const pinoInstance = this.createPinoInstance(name, config);
    return new PinoLoggerImpl(pinoInstance);
  }

  createRequestLogger(req: Request): ILogger {
    const baseLogger = this.createPinoInstance();

    // Extract correlation ID from request or generate one
    const correlationId = (req as any).id || req.headers?.['x-request-id'] || randomUUID();

    // Extract user ID if authenticated
    const user = (req as any).user?.[0];
    const userId = user?.sub;

    // Create child logger with request context
    const bindings: Record<string, unknown> = {
      correlationId,
      method: req.method,
      path: req.url,
    };

    if (userId) {
      bindings.userId = userId;
    }

    const childPinoInstance = baseLogger.child(bindings);
    return new PinoLoggerImpl(childPinoInstance);
  }

  getConfig(): LoggerConfig {
    return { ...this.config };
  }
}
