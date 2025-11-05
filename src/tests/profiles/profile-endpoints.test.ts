import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Response } from 'express';
import type { EndpointRequest } from '../../types/endpoint-handler';
import { profileCreateEndpoint } from '../../profiles/routes/profileCreate.endpoint';
import { profileUpdateEndpoint } from '../../profiles/routes/profileUpdate.endpoint';
import { profileFetchEndpoint } from '../../profiles/routes/profileFetch.endpoint';
import { dashboardFetchEndpoint } from '../../profiles/routes/dashboardFetch.endpoint';
import { profileStatisticsEndpoint } from '../../profiles/routes/profileStatistics.endpoint';
import type { ProfileService } from '../../profiles/service';
import type { Profile, ProfileStatistics } from '../../profiles/schemas';
import {
  ProfileNotFoundError,
  ProfileUnauthorizedError,
  ProfileCreationError,
  ProfileUpdateError,
} from '../../profiles/errors';

// Mock service
const mockService = {
  createProfile: vi.fn(),
  updateProfile: vi.fn(),
  getProfile: vi.fn(),
  getStatistics: vi.fn(),
  getDashboard: vi.fn(),
} as unknown as ProfileService;

describe('Profile Endpoints', () => {
  let req: Partial<EndpointRequest>;
  let res: Partial<Response>;

  const mockUserId = '550e8400-e29b-41d4-a716-446655440001';
  const mockProfile: Profile = {
    userId: mockUserId,
    bio: 'My bio',
    testimony: 'My testimony',
    profilePhotoMediaId: '550e8400-e29b-41d4-a716-446655440002',
    privacyMode: 'church_only',
    fieldVisibilitySettings: {},
    cachedMetrics: {},
    notificationPreferences: {},
    preferredDevotionalTime: '08:00:00',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    req = {
      body: {},
      params: {},
      user: [null, { payload: { sub: mockUserId } }],
    } as any;

    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
  });

  describe('POST /profiles - Create Profile', () => {
    it('should create a profile successfully with Keycloak auto-population and return 201', async () => {
      const input = {
        bio: 'My bio',
        testimony: 'My testimony',
        privacyMode: 'church_only' as const,
      };

      req.body = input;
      mockService.createProfile = vi.fn().mockResolvedValue(mockProfile);

      const handler = profileCreateEndpoint(mockService);
      await handler(req as EndpointRequest, res as Response);

      // Zod schemas add defaults for fieldVisibilitySettings and notificationPreferences
      expect(mockService.createProfile).toHaveBeenCalledWith(
        mockUserId,
        expect.objectContaining({
          bio: 'My bio',
          testimony: 'My testimony',
          privacyMode: 'church_only',
        })
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        profile: mockProfile,
        success: true,
      });
    });

    it('should return 401 when user is not authenticated', async () => {
      req.user = undefined;

      const handler = profileCreateEndpoint(mockService);
      await handler(req as EndpointRequest, res as Response);

      expect(mockService.createProfile).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'User authentication required',
        success: false,
      });
    });

    it('should return 400 when service throws validation error', async () => {
      req.body = {
        bio: 'My bio',
      };
      mockService.createProfile = vi.fn().mockRejectedValue(new Error('Invalid profile data'));

      const handler = profileCreateEndpoint(mockService);
      await handler(req as EndpointRequest, res as Response);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid profile data',
        success: false,
      });
    });

    it('should return 500 when ProfileCreationError is thrown', async () => {
      req.body = {
        bio: 'My bio',
        testimony: 'My testimony',
        privacyMode: 'church_only' as const,
      };
      mockService.createProfile = vi.fn().mockRejectedValue(new ProfileCreationError('Database connection failed'));

      const handler = profileCreateEndpoint(mockService);
      await handler(req as EndpointRequest, res as Response);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Database connection failed',
        success: false,
      });
    });
  });

  describe('PUT /profiles/:userId - Update Profile', () => {
    it('should update own profile successfully and return 200', async () => {
      const updateData = {
        bio: 'Updated bio',
        testimony: 'Updated testimony',
      };

      req.params = { userId: mockUserId };
      req.body = updateData;

      const updatedProfile = { ...mockProfile, ...updateData };
      mockService.updateProfile = vi.fn().mockResolvedValue(updatedProfile);

      const handler = profileUpdateEndpoint(mockService);
      await handler(req as EndpointRequest, res as Response);

      // Service now receives requestingUserId parameter
      expect(mockService.updateProfile).toHaveBeenCalledWith(
        mockUserId,
        mockUserId,
        expect.objectContaining({
          bio: 'Updated bio',
          testimony: 'Updated testimony',
        })
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        profile: updatedProfile,
        success: true,
      });
    });

    it('should return 403 when attempting to update another user profile', async () => {
      const otherUserId = '550e8400-e29b-41d4-a716-446655440003';
      req.params = { userId: otherUserId };
      req.body = { bio: 'Updated bio' };

      // Service throws ProfileUnauthorizedError which errorCodeFactory maps to 403
      mockService.updateProfile = vi.fn().mockRejectedValue(
        new ProfileUnauthorizedError('Unauthorized to update this profile')
      );

      const handler = profileUpdateEndpoint(mockService);
      await handler(req as EndpointRequest, res as Response);

      expect(mockService.updateProfile).toHaveBeenCalledWith(
        otherUserId,
        mockUserId,
        expect.objectContaining({
          bio: 'Updated bio',
        })
      );
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Unauthorized to update this profile',
        success: false,
      });
    });

    it('should return 401 when user is not authenticated', async () => {
      req.user = undefined;
      req.params = { userId: mockUserId };

      const handler = profileUpdateEndpoint(mockService);
      await handler(req as EndpointRequest, res as Response);

      expect(mockService.updateProfile).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'User authentication required',
        success: false,
      });
    });

    it('should return 404 when ProfileNotFoundError is thrown', async () => {
      req.params = { userId: mockUserId };
      req.body = { bio: 'Updated bio' };
      mockService.updateProfile = vi.fn().mockRejectedValue(new ProfileNotFoundError(mockUserId));

      const handler = profileUpdateEndpoint(mockService);
      await handler(req as EndpointRequest, res as Response);

      expect(mockService.updateProfile).toHaveBeenCalledWith(
        mockUserId,
        mockUserId,
        expect.objectContaining({
          bio: 'Updated bio',
        })
      );
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: expect.stringContaining('Profile'),
        success: false,
      });
    });

    it('should return 500 when ProfileUpdateError is thrown', async () => {
      req.params = { userId: mockUserId };
      req.body = { bio: 'Updated bio' };
      mockService.updateProfile = vi.fn().mockRejectedValue(new ProfileUpdateError('Database error'));

      const handler = profileUpdateEndpoint(mockService);
      await handler(req as EndpointRequest, res as Response);

      expect(mockService.updateProfile).toHaveBeenCalledWith(
        mockUserId,
        mockUserId,
        expect.objectContaining({
          bio: 'Updated bio',
        })
      );
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Database error',
        success: false,
      });
    });
  });

  describe('GET /profiles/:userId - Fetch Profile', () => {
    it('should fetch profile successfully with privacy enforcement and return 200', async () => {
      req.params = { userId: mockUserId };
      mockService.getProfile = vi.fn().mockResolvedValue(mockProfile);

      const handler = profileFetchEndpoint(mockService);
      await handler(req as EndpointRequest, res as Response);

      expect(mockService.getProfile).toHaveBeenCalledWith(mockUserId, mockUserId);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        profile: mockProfile,
        success: true,
      });
    });

    it('should return 404 when access is denied due to privacy settings', async () => {
      const otherUserId = '550e8400-e29b-41d4-a716-446655440003';
      req.params = { userId: otherUserId };
      mockService.getProfile = vi.fn().mockRejectedValue(
        new ProfileNotFoundError(otherUserId)
      );

      const handler = profileFetchEndpoint(mockService);
      await handler(req as EndpointRequest, res as Response);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: expect.stringContaining('Profile'),
        success: false,
      });
    });

    it('should return 403 when ProfileUnauthorizedError is thrown', async () => {
      const otherUserId = '550e8400-e29b-41d4-a716-446655440003';
      req.params = { userId: otherUserId };
      mockService.getProfile = vi.fn().mockRejectedValue(new ProfileUnauthorizedError('Privacy settings prevent access'));

      const handler = profileFetchEndpoint(mockService);
      await handler(req as EndpointRequest, res as Response);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Privacy settings prevent access',
        success: false,
      });
    });

    it('should return 401 when user is not authenticated', async () => {
      req.user = undefined;
      req.params = { userId: mockUserId };

      const handler = profileFetchEndpoint(mockService);
      await handler(req as EndpointRequest, res as Response);

      expect(mockService.getProfile).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'User authentication required',
        success: false,
      });
    });
  });

  describe('GET /profiles/:userId/dashboard - Fetch Dashboard', () => {
    it('should fetch dashboard data successfully and return 200', async () => {
      const mockDashboard = {
        recentNotes: [
          {
            id: '550e8400-e29b-41d4-a716-446655440004',
            title: 'My Note',
            content: 'Note content',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        activePrayerRequests: [
          {
            id: '550e8400-e29b-41d4-a716-446655440005',
            title: 'Prayer Request',
            description: 'Please pray',
            status: 'active',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        devotionalProgress: [
          {
            seriesId: '550e8400-e29b-41d4-a716-446655440006',
            seriesName: 'Morning Series',
            postId: '550e8400-e29b-41d4-a716-446655440007',
            postTitle: 'Day 1',
            publishedAt: new Date(),
          },
        ],
        statistics: {
          notesCount: 10,
          prayersCount: 5,
          devotionalsCount: 3,
          daysActive: 15,
        },
      };

      req.params = { userId: mockUserId };
      mockService.getDashboard = vi.fn().mockResolvedValue(mockDashboard);

      const handler = dashboardFetchEndpoint(mockService);
      await handler(req as EndpointRequest, res as Response);

      expect(mockService.getDashboard).toHaveBeenCalledWith(mockUserId, mockUserId);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        dashboard: mockDashboard,
        success: true,
      });
    });

    it('should return 403 when attempting to view another user dashboard', async () => {
      const otherUserId = '550e8400-e29b-41d4-a716-446655440003';
      req.params = { userId: otherUserId };

      // Service throws ProfileUnauthorizedError which errorCodeFactory maps to 403
      mockService.getDashboard = vi.fn().mockRejectedValue(
        new ProfileUnauthorizedError('Unauthorized to view this dashboard')
      );

      const handler = dashboardFetchEndpoint(mockService);
      await handler(req as EndpointRequest, res as Response);

      expect(mockService.getDashboard).toHaveBeenCalledWith(otherUserId, mockUserId);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Unauthorized to view this dashboard',
        success: false,
      });
    });

    it('should return 401 when user is not authenticated', async () => {
      req.user = undefined;
      req.params = { userId: mockUserId };

      const handler = dashboardFetchEndpoint(mockService);
      await handler(req as EndpointRequest, res as Response);

      expect(mockService.getDashboard).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'User authentication required',
        success: false,
      });
    });
  });

  describe('GET /profiles/:userId/statistics - Fetch Statistics', () => {
    it('should fetch statistics successfully and return 200', async () => {
      const mockStatistics: ProfileStatistics = {
        notesCount: 10,
        prayersCount: 5,
        devotionalsCount: 3,
        daysActive: 15,
      };

      req.params = { userId: mockUserId };
      mockService.getStatistics = vi.fn().mockResolvedValue(mockStatistics);

      const handler = profileStatisticsEndpoint(mockService);
      await handler(req as EndpointRequest, res as Response);

      expect(mockService.getStatistics).toHaveBeenCalledWith(mockUserId);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        statistics: mockStatistics,
        success: true,
      });
    });

    it('should return 401 when user is not authenticated', async () => {
      req.user = undefined;
      req.params = { userId: mockUserId };

      const handler = profileStatisticsEndpoint(mockService);
      await handler(req as EndpointRequest, res as Response);

      expect(mockService.getStatistics).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'User authentication required',
        success: false,
      });
    });

    it('should return 400 when service throws an error', async () => {
      req.params = { userId: mockUserId };
      mockService.getStatistics = vi.fn().mockRejectedValue(new Error('Failed to calculate statistics'));

      const handler = profileStatisticsEndpoint(mockService);
      await handler(req as EndpointRequest, res as Response);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Failed to calculate statistics',
        success: false,
      });
    });
  });
});
