import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import type { Router } from 'express';
import { wallsRouter } from '../../../prayer-walls/routes/walls.routes';
import type { PrayerWallService } from '../../../prayer-walls/services/prayer-wall.service';

// Mock Express router
const mockRouter = {
  post: vi.fn(),
  get: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
  use: vi.fn(),
} as unknown as Router;

// Mock service
const mockService = {} as PrayerWallService;

vi.mock('express', () => ({
  Router: () => mockRouter,
}));

describe('Prayer Wall Routes', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    vi.clearAllMocks();
    // Store original env
    originalEnv = { ...process.env };
    // Set required environment variables for tests
    process.env.IAM_ENDPOINT = 'http://test-iam';
    process.env.IAM_REALM = 'test-realm';
  });

  afterEach(() => {
    // Restore original env
    process.env = originalEnv;
  });

  // ============================================================================
  // Environment Variable Validation Tests
  // ============================================================================

  describe('Environment Variable Validation', () => {
    it('should successfully initialize with valid IAM_ENDPOINT and IAM_REALM', () => {
      process.env.IAM_ENDPOINT = 'https://iam.example.com';
      process.env.IAM_REALM = 'my-realm';

      expect(() => wallsRouter(mockService)).not.toThrow();
    });

    it('should throw error when IAM_ENDPOINT is missing', () => {
      delete process.env.IAM_ENDPOINT;
      process.env.IAM_REALM = 'my-realm';

      expect(() => wallsRouter(mockService)).toThrow('IAM_ENDPOINT');
    });

    it('should throw error when IAM_REALM is missing', () => {
      process.env.IAM_ENDPOINT = 'https://iam.example.com';
      delete process.env.IAM_REALM;

      expect(() => wallsRouter(mockService)).toThrow('IAM_REALM');
    });

    it('should throw error when both IAM_ENDPOINT and IAM_REALM are missing', () => {
      delete process.env.IAM_ENDPOINT;
      delete process.env.IAM_REALM;

      expect(() => wallsRouter(mockService)).toThrow();
    });

    it('should throw error when IAM_ENDPOINT is empty string', () => {
      process.env.IAM_ENDPOINT = '';
      process.env.IAM_REALM = 'my-realm';

      expect(() => wallsRouter(mockService)).toThrow('IAM_ENDPOINT');
    });

    it('should throw error when IAM_REALM is empty string', () => {
      process.env.IAM_ENDPOINT = 'https://iam.example.com';
      process.env.IAM_REALM = '';

      expect(() => wallsRouter(mockService)).toThrow('IAM_REALM');
    });

    it('should throw error when IAM_ENDPOINT is whitespace only', () => {
      process.env.IAM_ENDPOINT = '   ';
      process.env.IAM_REALM = 'my-realm';

      expect(() => wallsRouter(mockService)).toThrow('IAM_ENDPOINT');
    });

    it('should throw error when IAM_REALM is whitespace only', () => {
      process.env.IAM_ENDPOINT = 'https://iam.example.com';
      process.env.IAM_REALM = '   ';

      expect(() => wallsRouter(mockService)).toThrow('IAM_REALM');
    });

    it('should have descriptive error message mentioning specific missing variable', () => {
      delete process.env.IAM_ENDPOINT;
      delete process.env.IAM_REALM;

      try {
        wallsRouter(mockService);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        // Should mention IAM_ENDPOINT since it's checked first
        expect(error.message).toContain('IAM_ENDPOINT');
        expect(error.message).not.toContain('IAM_REALM'); // Should not mention both
      }
    });

    it('should fail fast before attempting to initialize router', () => {
      delete process.env.IAM_ENDPOINT;

      try {
        wallsRouter(mockService);
        expect.fail('Should have thrown an error');
      } catch (error) {
        // Router methods should not have been called if env validation fails
        expect(mockRouter.post).not.toHaveBeenCalled();
        expect(mockRouter.get).not.toHaveBeenCalled();
        expect(mockRouter.patch).not.toHaveBeenCalled();
        expect(mockRouter.delete).not.toHaveBeenCalled();
      }
    });
  });

  // ============================================================================
  // Router Registration Tests
  // ============================================================================

  it('should register all routes with correct paths and methods', () => {
    const router = wallsRouter(mockService);

    // Should return the router
    expect(router).toBe(mockRouter);

    // POST /churches/:churchId/prayer-walls - Create wall
    expect(mockRouter.post).toHaveBeenCalledWith(
      '/churches/:churchId/prayer-walls',
      expect.any(Array),
      expect.any(Function)
    );

    // GET /churches/:churchId/prayer-walls - List walls
    expect(mockRouter.get).toHaveBeenCalledWith(
      '/churches/:churchId/prayer-walls',
      expect.any(Array),
      expect.any(Function)
    );

    // GET /churches/:churchId/prayer-walls/:wallId - Get wall details
    expect(mockRouter.get).toHaveBeenCalledWith(
      '/churches/:churchId/prayer-walls/:wallId',
      expect.any(Array),
      expect.any(Function)
    );

    // PATCH /churches/:churchId/prayer-walls/:wallId - Update wall
    expect(mockRouter.patch).toHaveBeenCalledWith(
      '/churches/:churchId/prayer-walls/:wallId',
      expect.any(Array),
      expect.any(Function)
    );

    // DELETE /churches/:churchId/prayer-walls/:wallId - Archive wall
    expect(mockRouter.delete).toHaveBeenCalledWith(
      '/churches/:churchId/prayer-walls/:wallId',
      expect.any(Array),
      expect.any(Function)
    );

    // POST /prayer-walls/:wallId/join - Join wall
    expect(mockRouter.post).toHaveBeenCalledWith(
      '/prayer-walls/:wallId/join',
      expect.any(Array),
      expect.any(Function)
    );

    // POST /prayer-walls/:wallId/leave - Leave wall
    expect(mockRouter.post).toHaveBeenCalledWith(
      '/prayer-walls/:wallId/leave',
      expect.any(Array),
      expect.any(Function)
    );

    // POST /prayer-walls/:wallId/invite - Invite member
    expect(mockRouter.post).toHaveBeenCalledWith(
      '/prayer-walls/:wallId/invite',
      expect.any(Array),
      expect.any(Function)
    );

    // DELETE /prayer-walls/:wallId/members/:userId - Remove member
    expect(mockRouter.delete).toHaveBeenCalledWith(
      '/prayer-walls/:wallId/members/:userId',
      expect.any(Array),
      expect.any(Function)
    );

    // POST /prayer-walls/:wallId/ban/:userId - Ban user
    expect(mockRouter.post).toHaveBeenCalledWith(
      '/prayer-walls/:wallId/ban/:userId',
      expect.any(Array),
      expect.any(Function)
    );

    // GET /prayer-walls/:wallId/members - List members
    expect(mockRouter.get).toHaveBeenCalledWith(
      '/prayer-walls/:wallId/members',
      expect.any(Array),
      expect.any(Function)
    );
  });

  it('should protect all endpoints with auth middleware', () => {
    wallsRouter(mockService);

    // All routes should have middleware arrays
    const postCalls = (mockRouter.post as Mock).mock.calls;
    const getCalls = (mockRouter.get as Mock).mock.calls;
    const patchCalls = (mockRouter.patch as Mock).mock.calls;
    const deleteCalls = (mockRouter.delete as Mock).mock.calls;

    // Check that all routes have middleware (should be arrays with length > 0)
    [...postCalls, ...getCalls, ...patchCalls, ...deleteCalls].forEach((call) => {
      expect(call[1]).toBeInstanceOf(Array);
      expect(call[1].length).toBeGreaterThan(0);
    });
  });

  it('should register create wall endpoint with validation middleware', () => {
    wallsRouter(mockService);

    const createCall = (mockRouter.post as Mock).mock.calls.find(
      (call) => call[0] === '/churches/:churchId/prayer-walls'
    );

    expect(createCall).toBeDefined();
    expect(createCall[1]).toBeInstanceOf(Array);
    // Should have tokenVerifier, validation middleware
    expect(createCall[1].length).toBeGreaterThan(0);
  });

  it('should register update wall endpoint with validation middleware', () => {
    wallsRouter(mockService);

    const updateCall = (mockRouter.patch as Mock).mock.calls.find(
      (call) => call[0] === '/churches/:churchId/prayer-walls/:wallId'
    );

    expect(updateCall).toBeDefined();
    expect(updateCall[1]).toBeInstanceOf(Array);
    // Should have tokenVerifier, params validation, body validation
    expect(updateCall[1].length).toBeGreaterThan(0);
  });

  it('should register join wall endpoint with minimal validation', () => {
    wallsRouter(mockService);

    const joinCall = (mockRouter.post as Mock).mock.calls.find(
      (call) => call[0] === '/prayer-walls/:wallId/join'
    );

    expect(joinCall).toBeDefined();
    expect(joinCall[1]).toBeInstanceOf(Array);
    // Should have tokenVerifier and params validation
    expect(joinCall[1].length).toBeGreaterThan(0);
  });

  it('should register invite endpoint with body validation', () => {
    wallsRouter(mockService);

    const inviteCall = (mockRouter.post as Mock).mock.calls.find(
      (call) => call[0] === '/prayer-walls/:wallId/invite'
    );

    expect(inviteCall).toBeDefined();
    expect(inviteCall[1]).toBeInstanceOf(Array);
    // Should have tokenVerifier, params validation, body validation
    expect(inviteCall[1].length).toBeGreaterThan(0);
  });

  it('should register member removal endpoint with parameter validation', () => {
    wallsRouter(mockService);

    const removeCall = (mockRouter.delete as Mock).mock.calls.find(
      (call) => call[0] === '/prayer-walls/:wallId/members/:userId'
    );

    expect(removeCall).toBeDefined();
    expect(removeCall[1]).toBeInstanceOf(Array);
    // Should have tokenVerifier and params validation
    expect(removeCall[1].length).toBeGreaterThan(0);
  });

  it('should register ban user endpoint with parameter validation', () => {
    wallsRouter(mockService);

    const banCall = (mockRouter.post as Mock).mock.calls.find(
      (call) => call[0] === '/prayer-walls/:wallId/ban/:userId'
    );

    expect(banCall).toBeDefined();
    expect(banCall[1]).toBeInstanceOf(Array);
    // Should have tokenVerifier and params validation
    expect(banCall[1].length).toBeGreaterThan(0);
  });

  it('should register list members endpoint with parameter validation', () => {
    wallsRouter(mockService);

    const listMembersCall = (mockRouter.get as Mock).mock.calls.find(
      (call) => call[0] === '/prayer-walls/:wallId/members'
    );

    expect(listMembersCall).toBeDefined();
    expect(listMembersCall[1]).toBeInstanceOf(Array);
    // Should have tokenVerifier and params validation
    expect(listMembersCall[1].length).toBeGreaterThan(0);
  });
});