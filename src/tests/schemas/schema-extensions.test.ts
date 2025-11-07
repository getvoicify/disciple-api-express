import { describe, expect, it } from 'vitest';
import { ChurchMember } from '../../churches/schemas';
import { Post } from '../../posts/schemas';
import { Series } from '../../series/schemas';
import type { PrayerWallMembership, PrayerWall } from '../../prayer-walls/types/prayer-wall.types';
import type { UserInfo } from '../../user-info/types';
import type { ChurchInfo } from '../../church-info/types';

describe('Schema Extensions for Embedded Fields', () => {
  describe('ChurchMember schema with embedded user', () => {
    it('should validate ChurchMember with embedded user field', () => {
      const mockUserInfo: UserInfo = {
        userId: '550e8400-e29b-41d4-a716-446655440003',
        firstName: 'John',
        lastName: 'Doe',
        displayName: 'John Doe',
        avatarUrl: 'https://example.com/avatar.jpg',
        email: 'john@example.com',
      };

      const memberWithUser = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        churchId: '550e8400-e29b-41d4-a716-446655440002',
        userId: '550e8400-e29b-41d4-a716-446655440003',
        role: 'Member',
        status: 'Active',
        joinedAt: new Date(),
        updatedAt: new Date(),
        user: mockUserInfo,
      };

      const result = ChurchMember.safeParse(memberWithUser);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.user).toEqual(mockUserInfo);
      }
    });

    it('should validate ChurchMember without user field (backward compatibility)', () => {
      const memberWithoutUser = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        churchId: '550e8400-e29b-41d4-a716-446655440002',
        userId: '550e8400-e29b-41d4-a716-446655440003',
        role: 'Member',
        status: 'Active',
        joinedAt: new Date(),
        updatedAt: new Date(),
      };

      const result = ChurchMember.safeParse(memberWithoutUser);
      expect(result.success).toBe(true);
    });
  });

  describe('PrayerWallMembership type with embedded user', () => {
    it('should accept user field in PrayerWallMembership type', () => {
      const mockUserInfo: UserInfo = {
        userId: 'user-123',
        firstName: 'Jane',
        lastName: 'Smith',
        displayName: 'Jane Smith',
        avatarUrl: null,
        email: 'jane@example.com',
      };

      const membership: PrayerWallMembership = {
        id: 'membership-1',
        wall_id: 'wall-1',
        user_id: 'user-123',
        joined_at: new Date(),
        invited_by: null,
        left_at: null,
        is_banned: false,
        banned_at: null,
        banned_by: null,
        created_at: new Date(),
        updated_at: new Date(),
        user: mockUserInfo,
      };

      expect(membership.user).toEqual(mockUserInfo);
      expect(membership.user_id).toBe('user-123');
    });
  });

  describe('Post schema with embedded church', () => {
    it('should validate Post with embedded church field', () => {
      const mockChurchInfo: ChurchInfo = {
        id: '550e8400-e29b-41d4-a716-446655440003',
        slug: 'test-church',
        name: 'Test Church',
        description: 'A test church',
        logoUrl: 'https://example.com/logo.jpg',
        byline: 'Come as you are',
      };

      const postWithChurch = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        title: 'Test Post',
        content: 'Test content',
        authorId: '550e8400-e29b-41d4-a716-446655440002',
        churchId: '550e8400-e29b-41d4-a716-446655440003',
        status: 'published',
        publishedAt: new Date(),
        image: null,
        tags: [],
        categories: [],
        scriptureReferences: [],
        seriesId: null,
        seriesName: null,
        church: mockChurchInfo,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = Post.safeParse(postWithChurch);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.church).toEqual(mockChurchInfo);
      }
    });

    it('should validate Post without church field (backward compatibility)', () => {
      const postWithoutChurch = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        title: 'Test Post',
        content: 'Test content',
        authorId: '550e8400-e29b-41d4-a716-446655440002',
        churchId: '550e8400-e29b-41d4-a716-446655440003',
        status: 'published',
        publishedAt: new Date(),
        image: null,
        tags: [],
        categories: [],
        scriptureReferences: [],
        seriesId: null,
        seriesName: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = Post.safeParse(postWithoutChurch);
      expect(result.success).toBe(true);
    });
  });

  describe('Series schema with embedded church', () => {
    it('should validate Series with embedded church field', () => {
      const mockChurchInfo: ChurchInfo = {
        id: '550e8400-e29b-41d4-a716-446655440003',
        slug: 'test-church',
        name: 'Test Church',
        description: 'A test church',
        logoUrl: 'https://example.com/logo.jpg',
        byline: 'All are welcome',
      };

      const seriesWithChurch = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        title: 'Test Series',
        description: 'Test description',
        image: null,
        authorId: '550e8400-e29b-41d4-a716-446655440002',
        churchId: '550e8400-e29b-41d4-a716-446655440003',
        status: 'published',
        publishedAt: new Date(),
        church: mockChurchInfo,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = Series.safeParse(seriesWithChurch);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.church).toEqual(mockChurchInfo);
      }
    });
  });

  describe('PrayerWall type with embedded church', () => {
    it('should accept church field in PrayerWall type', () => {
      const mockChurchInfo: ChurchInfo = {
        id: '550e8400-e29b-41d4-a716-446655440003',
        slug: 'test-church',
        name: 'Test Church',
        description: 'A test church',
        logoUrl: 'https://example.com/logo.jpg',
        byline: 'Prayer changes things',
      };

      const prayerWall: PrayerWall = {
        id: 'wall-1',
        church_id: '550e8400-e29b-41d4-a716-446655440003',
        name: 'Sunday Prayer Wall',
        description: 'Weekly prayers',
        created_by: 'user-1',
        is_private: false,
        has_restricted_access: false,
        schedule: null,
        video_call_link: null,
        status: 'active',
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
        church: mockChurchInfo,
      };

      expect(prayerWall.church).toEqual(mockChurchInfo);
      expect(prayerWall.church_id).toBe('550e8400-e29b-41d4-a716-446655440003');
    });
  });
});
