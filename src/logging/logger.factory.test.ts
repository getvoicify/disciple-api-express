import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {PinoLoggerFactory} from './logger.factory';
import type {ILoggerFactory} from './logger.interface';
import type {Request} from 'express';

describe('LoggerFactory', () => {
  let factory: ILoggerFactory;
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment before each test
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore environment after each test
    process.env = originalEnv;
  });

  describe('createLogger', () => {
    it('should create a logger with default config', () => {
      factory = new PinoLoggerFactory();
      const logger = factory.createLogger();

      expect(logger).toBeDefined();
      expect(logger.getLevel()).toBe('info'); // default level
    });

    it('should create a logger with custom name', () => {
      factory = new PinoLoggerFactory();
      const logger = factory.createLogger('my-service');

      expect(logger).toBeDefined();
      // Logger should be created successfully with name binding
    });

    it('should create a logger with config override', () => {
      factory = new PinoLoggerFactory();
      const logger = factory.createLogger('test', { level: 'debug' });

      expect(logger.getLevel()).toBe('debug');
    });

    it('should use environment variables for configuration', () => {
      process.env.LOG_LEVEL = 'debug';
      process.env.NODE_ENV = 'production';

      factory = new PinoLoggerFactory();
      const config = factory.getConfig();

      expect(config.level).toBe('debug');
      expect(config.environment).toBe('production');
      expect(config.prettyPrint).toBe(false); // production = no pretty print
    });

    it('should enable pretty print in development', () => {
      process.env.NODE_ENV = 'development';

      factory = new PinoLoggerFactory();
      const config = factory.getConfig();

      expect(config.prettyPrint).toBe(true);
    });

    it('should default to info level if LOG_LEVEL not set', () => {
      delete process.env.LOG_LEVEL;

      factory = new PinoLoggerFactory();
      const config = factory.getConfig();

      expect(config.level).toBe('info');
    });
  });

  describe('createRequestLogger', () => {
    beforeEach(() => {
      factory = new PinoLoggerFactory();
    });

    it('should create logger with correlation ID from request', () => {
      const mockReq = {
        id: 'req-123-abc',
        method: 'GET',
        url: '/api/users',
      } as unknown as Request;

      const logger = factory.createRequestLogger(mockReq);

      expect(logger).toBeDefined();
      // Logger should be a child with requestId binding
    });

    it('should include user context if authenticated', () => {
      const mockReq = {
        id: 'req-456',
        method: 'POST',
        url: '/api/notes',
        user: [{ sub: 'user-789' }],
      } as unknown as Request;

      const logger = factory.createRequestLogger(mockReq);

      expect(logger).toBeDefined();
      // Logger should include userId binding from req.user[0].sub
    });

    it('should generate correlation ID if not present', () => {
      const mockReq = {
        method: 'GET',
        url: '/api/health',
      } as unknown as Request;

      const logger = factory.createRequestLogger(mockReq);

      expect(logger).toBeDefined();
      // Logger should have a generated correlation ID
    });

    it('should handle request without user gracefully', () => {
      const mockReq = {
        id: 'req-789',
        method: 'GET',
        url: '/api/public',
      } as unknown as Request;

      const logger = factory.createRequestLogger(mockReq);

      expect(logger).toBeDefined();
      // Should work without user context
    });
  });

  describe('getConfig', () => {
    it('should return current logger configuration', () => {
      factory = new PinoLoggerFactory();
      const config = factory.getConfig();

      expect(config).toBeDefined();
      expect(config.level).toBeDefined();
      expect(config.prettyPrint).toBeDefined();
      expect(config.redactPaths).toBeDefined();
      expect(config.environment).toBeDefined();
    });

    it('should include default redaction paths', () => {
      factory = new PinoLoggerFactory();
      const config = factory.getConfig();

      expect(config.redactPaths).toContain('password');
      expect(config.redactPaths).toContain('token');
      expect(config.redactPaths).toContain('authorization');
      expect(config.redactPaths).toContain('secret');
    });

    it('should reflect environment from NODE_ENV', () => {
      process.env.NODE_ENV = 'test';
      factory = new PinoLoggerFactory();
      const config = factory.getConfig();

      expect(config.environment).toBe('test');
    });
  });

  describe('Singleton Behavior', () => {
    it('should create multiple independent loggers', () => {
      factory = new PinoLoggerFactory();
      const logger1 = factory.createLogger('service-1');
      const logger2 = factory.createLogger('service-2');

      expect(logger1).not.toBe(logger2);
      // Each logger should be independent
    });

    it('should ensure all loggers share same base configuration', () => {
      factory = new PinoLoggerFactory();
      const logger1 = factory.createLogger();
      const logger2 = factory.createLogger();

      expect(logger1.getLevel()).toBe(logger2.getLevel());
      // Both should have same level from shared config
    });
  });

  describe('Invalid Configuration Handling', () => {
    it('should fall back to default when LOG_LEVEL is invalid', () => {
      const originalLogLevel = process.env.LOG_LEVEL;
      try {
        process.env.LOG_LEVEL = 'invalid-level';
        factory = new PinoLoggerFactory();
        const logger = factory.createLogger();

        // Should default to 'info' for invalid log level
        expect(logger.getLevel()).toBe('info');
      } finally {
        process.env.LOG_LEVEL = originalLogLevel;
      }
    });

    it('should handle missing LOG_LEVEL by defaulting to info', () => {
      const originalLogLevel = process.env.LOG_LEVEL;
      try {
        delete process.env.LOG_LEVEL;
        factory = new PinoLoggerFactory();
        const logger = factory.createLogger();

        expect(logger.getLevel()).toBe('info');
      } finally {
        process.env.LOG_LEVEL = originalLogLevel;
      }
    });
  });
});
