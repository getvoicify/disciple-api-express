import {beforeEach, describe, expect, it, vi} from 'vitest';
import {PinoLoggerImpl} from './pino-logger.impl';
import type {ILogger} from './logger.interface';

describe('PinoLogger', () => {
  let logger: ILogger;
  let mockPinoInstance: any;

  beforeEach(() => {
    mockPinoInstance = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      trace: vi.fn(),
      fatal: vi.fn(),
      child: vi.fn(),
      level: 'info',
    };
    logger = new PinoLoggerImpl(mockPinoInstance);
  });

  describe('Logging Methods', () => {
    it('should log info message with string only', () => {
      logger.info('test message');
      expect(mockPinoInstance.info).toHaveBeenCalledWith('test message');
    });

    it('should log info message with context', () => {
      logger.info('test message', { userId: '123', action: 'login' });
      expect(mockPinoInstance.info).toHaveBeenCalledWith(
        { userId: '123', action: 'login' },
        'test message'
      );
    });

    it('should support Pino-style context-first syntax for info', () => {
      logger.info({ userId: '456' }, 'user action');
      expect(mockPinoInstance.info).toHaveBeenCalledWith({ userId: '456' }, 'user action');
    });

    it('should log error with Error object', () => {
      const error = new Error('Something went wrong');
      logger.error('Operation failed', error, { operation: 'database-query' });
      expect(mockPinoInstance.error).toHaveBeenCalledWith(
        { err: error, operation: 'database-query' },
        'Operation failed'
      );
    });

    it('should log error without Error object', () => {
      logger.error('Operation failed', undefined, { operation: 'fetch' });
      expect(mockPinoInstance.error).toHaveBeenCalledWith(
        { operation: 'fetch' },
        'Operation failed'
      );
    });

    it('should log error with just message', () => {
      logger.error('Operation failed');
      expect(mockPinoInstance.error).toHaveBeenCalledWith('Operation failed');
    });

    it('should support Pino-style context-first syntax for error', () => {
      logger.error({ code: 'ERR_001' }, 'error occurred');
      expect(mockPinoInstance.error).toHaveBeenCalledWith({ code: 'ERR_001' }, 'error occurred');
    });

    it('should log warn message', () => {
      logger.warn('deprecated API used', { api: '/old-endpoint' });
      expect(mockPinoInstance.warn).toHaveBeenCalledWith(
        { api: '/old-endpoint' },
        'deprecated API used'
      );
    });

    it('should log debug message', () => {
      logger.debug('debugging info', { step: 'validation' });
      expect(mockPinoInstance.debug).toHaveBeenCalledWith(
        { step: 'validation' },
        'debugging info'
      );
    });

    it('should log trace message', () => {
      logger.trace('entering function', { function: 'processRequest' });
      expect(mockPinoInstance.trace).toHaveBeenCalledWith(
        { function: 'processRequest' },
        'entering function'
      );
    });

    it('should log fatal message with error', () => {
      const fatalError = new Error('Critical failure');
      logger.fatal('System shutdown', fatalError);
      expect(mockPinoInstance.fatal).toHaveBeenCalledWith(
        { err: fatalError },
        'System shutdown'
      );
    });

    it('should log fatal message without error', () => {
      logger.fatal('System shutdown');
      expect(mockPinoInstance.fatal).toHaveBeenCalledWith('System shutdown');
    });
  });

  describe('Child Logger', () => {
    it('should create child logger with bindings', () => {
      const childPinoInstance = {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
        trace: vi.fn(),
        fatal: vi.fn(),
        child: vi.fn(),
        level: 'info',
      };
      mockPinoInstance.child.mockReturnValue(childPinoInstance);

      const childLogger = logger.child({ requestId: 'abc-123', userId: '456' });

      expect(mockPinoInstance.child).toHaveBeenCalledWith({
        requestId: 'abc-123',
        userId: '456',
      });
      expect(childLogger).toBeDefined();
      expect(childLogger).toBeInstanceOf(PinoLoggerImpl);
    });

    it('should child logger use underlying Pino child instance', () => {
      const childPinoInstance = {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
        trace: vi.fn(),
        fatal: vi.fn(),
        child: vi.fn(),
        level: 'info',
      };
      mockPinoInstance.child.mockReturnValue(childPinoInstance);

      const childLogger = logger.child({ service: 'auth' });
      childLogger.info('user logged in');

      expect(childPinoInstance.info).toHaveBeenCalledWith('user logged in');
    });
  });

  describe('Log Level Management', () => {
    it('should get current log level', () => {
      expect(logger.getLevel()).toBe('info');
    });

    it('should set log level', () => {
      logger.setLevel('debug');
      expect(mockPinoInstance.level).toBe('debug');
    });

    it('should reflect level changes when getting level', () => {
      mockPinoInstance.level = 'warn';
      expect(logger.getLevel()).toBe('warn');
    });
  });
});
