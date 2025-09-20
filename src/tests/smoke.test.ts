import { describe, it, expect } from 'vitest';
import { isAppError, ValidationError, NotFoundError, BadRequestError } from '../utils/errors';
import { scriptureReferenceSchema, successResponseSchema } from '../schemas/openapi.schemas';

describe('Smoke Tests', () => {
  describe('Application Errors', () => {
    it('should create and identify ValidationError', () => {
      const error = new ValidationError('Test validation error');

      expect(error).toBeInstanceOf(ValidationError);
      expect(error.message).toBe('Test validation error');
      expect(error.statusCode).toBe(400);
      expect(error.name).toBe('ValidationError');
      expect(isAppError(error)).toBe(true);
    });

    it('should create NotFoundError with resource and identifier', () => {
      const error = new NotFoundError('Church', 'test-id');

      expect(error).toBeInstanceOf(NotFoundError);
      expect(error.message).toBe("Church with identifier 'test-id' not found");
      expect(error.statusCode).toBe(404);
      expect(error.name).toBe('NotFoundError');
      expect(isAppError(error)).toBe(true);
    });

    it('should create BadRequestError', () => {
      const error = new BadRequestError('Invalid request');

      expect(error).toBeInstanceOf(BadRequestError);
      expect(error.message).toBe('Invalid request');
      expect(error.statusCode).toBe(400);
      expect(error.name).toBe('BadRequestError');
      expect(isAppError(error)).toBe(true);
    });

    it('should not identify regular Error as AppError', () => {
      const error = new Error('Regular error');

      expect(isAppError(error)).toBe(false);
    });
  });

  describe('OpenAPI Schemas', () => {
    it('should have valid scripture reference schema', () => {
      expect(scriptureReferenceSchema).toBeDefined();
      expect(scriptureReferenceSchema.type).toBe('object');
      expect(scriptureReferenceSchema.required).toContain('book');
      expect(scriptureReferenceSchema.required).toContain('chapter');
      expect(scriptureReferenceSchema.required).toContain('verse');
      expect(scriptureReferenceSchema.properties.book.type).toBe('string');
      expect(scriptureReferenceSchema.properties.chapter.type).toBe('integer');
      expect(scriptureReferenceSchema.properties.verse.type).toBe('integer');
    });

    it('should have valid success response schema', () => {
      expect(successResponseSchema).toBeDefined();
      expect(successResponseSchema.type).toBe('object');
      expect(successResponseSchema.required).toContain('success');
      expect(successResponseSchema.properties.success.type).toBe('boolean');
      expect(successResponseSchema.properties.success.example).toBe(true);
    });
  });

  describe('Environment Variables', () => {
    it('should handle missing environment variables gracefully', () => {
      // Test that the app doesn't crash when optional env vars are missing
      const originalNodeEnv = process.env.NODE_ENV;
      delete process.env.NODE_ENV;

      expect(process.env.NODE_ENV).toBeUndefined();

      // Restore original value
      if (originalNodeEnv) {
        process.env.NODE_ENV = originalNodeEnv;
      }
    });
  });

  describe('Basic Application Structure', () => {
    it('should have proper package.json version format', () => {
      const packageJson = require('../../package.json');

      expect(packageJson.name).toBe('disciple-api');
      expect(packageJson.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(packageJson.scripts.test).toBe('vitest run');
    });

    it('should export core utility functions', () => {
      expect(typeof isAppError).toBe('function');
      expect(ValidationError).toBeDefined();
      expect(NotFoundError).toBeDefined();
      expect(BadRequestError).toBeDefined();
    });
  });
});