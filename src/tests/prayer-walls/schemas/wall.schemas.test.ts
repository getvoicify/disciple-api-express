import { describe, it, expect } from 'vitest';
import {
  WallSchedule,
  CreateWallInput,
  UpdateWallInput,
} from '../../../prayer-walls/schemas/wall.schemas';
import { ZodError } from 'zod';

describe('PrayerWall Schemas', () => {
  // ============================================================================
  // WallSchedule Validation Tests
  // ============================================================================

  describe('WallSchedule - Timezone Validation', () => {
    it('should accept valid IANA timezone (America/New_York)', () => {
      const validSchedule = {
        frequency: 'daily' as const,
        time: '09:30',
        timezone: 'America/New_York',
      };

      const result = WallSchedule.safeParse(validSchedule);
      expect(result.success).toBe(true);
    });

    it('should accept valid IANA timezone (Europe/London)', () => {
      const validSchedule = {
        frequency: 'weekly' as const,
        day: 'Monday',
        time: '18:00',
        timezone: 'Europe/London',
      };

      const result = WallSchedule.safeParse(validSchedule);
      expect(result.success).toBe(true);
    });

    it('should accept valid IANA timezone (Africa/Lagos)', () => {
      const validSchedule = {
        frequency: 'monthly' as const,
        time: '06:00',
        timezone: 'Africa/Lagos',
      };

      const result = WallSchedule.safeParse(validSchedule);
      expect(result.success).toBe(true);
    });

    it('should reject invalid timezone (Invalid/Zone)', () => {
      const invalidSchedule = {
        frequency: 'daily' as const,
        time: '09:30',
        timezone: 'Invalid/Zone',
      };

      const result = WallSchedule.safeParse(invalidSchedule);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('timezone');
      }
    });

    it('should reject empty timezone string', () => {
      const invalidSchedule = {
        frequency: 'daily' as const,
        time: '09:30',
        timezone: '',
      };

      const result = WallSchedule.safeParse(invalidSchedule);
      expect(result.success).toBe(false);
    });

    it('should reject undefined timezone', () => {
      const invalidSchedule = {
        frequency: 'daily' as const,
        time: '09:30',
      };

      const result = WallSchedule.safeParse(invalidSchedule);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('timezone');
      }
    });
  });

  describe('WallSchedule - Time Format Validation', () => {
    it('should accept valid time format (09:30)', () => {
      const validSchedule = {
        frequency: 'daily' as const,
        time: '09:30',
        timezone: 'America/New_York',
      };

      const result = WallSchedule.safeParse(validSchedule);
      expect(result.success).toBe(true);
    });

    it('should accept valid time format (23:59)', () => {
      const validSchedule = {
        frequency: 'daily' as const,
        time: '23:59',
        timezone: 'America/New_York',
      };

      const result = WallSchedule.safeParse(validSchedule);
      expect(result.success).toBe(true);
    });

    it('should accept valid time format (00:00)', () => {
      const validSchedule = {
        frequency: 'daily' as const,
        time: '00:00',
        timezone: 'America/New_York',
      };

      const result = WallSchedule.safeParse(validSchedule);
      expect(result.success).toBe(true);
    });

    it('should reject invalid time format (25:00)', () => {
      const invalidSchedule = {
        frequency: 'daily' as const,
        time: '25:00',
        timezone: 'America/New_York',
      };

      const result = WallSchedule.safeParse(invalidSchedule);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('time format');
      }
    });

    it('should reject invalid time format (12:60)', () => {
      const invalidSchedule = {
        frequency: 'daily' as const,
        time: '12:60',
        timezone: 'America/New_York',
      };

      const result = WallSchedule.safeParse(invalidSchedule);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('time format');
      }
    });

    it('should reject invalid time format (9:30) - missing leading zero', () => {
      const invalidSchedule = {
        frequency: 'daily' as const,
        time: '9:30',
        timezone: 'America/New_York',
      };

      const result = WallSchedule.safeParse(invalidSchedule);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('time format');
      }
    });

    it('should reject invalid time format (12:5) - missing leading zero in minutes', () => {
      const invalidSchedule = {
        frequency: 'daily' as const,
        time: '12:5',
        timezone: 'America/New_York',
      };

      const result = WallSchedule.safeParse(invalidSchedule);
      expect(result.success).toBe(false);
    });

    it('should reject empty time string', () => {
      const invalidSchedule = {
        frequency: 'daily' as const,
        time: '',
        timezone: 'America/New_York',
      };

      const result = WallSchedule.safeParse(invalidSchedule);
      expect(result.success).toBe(false);
    });
  });

  // ============================================================================
  // CreateWallInput - Description Length Validation
  // ============================================================================

  describe('CreateWallInput - Description Length', () => {
    it('should accept description under 2000 chars', () => {
      const validInput = {
        name: 'Test Wall',
        description: 'A'.repeat(1000), // 1000 characters
      };

      const result = CreateWallInput.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('should accept description at exactly 2000 chars', () => {
      const validInput = {
        name: 'Test Wall',
        description: 'A'.repeat(2000), // Exactly 2000 characters
      };

      const result = CreateWallInput.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('should reject description over 2000 chars', () => {
      const invalidInput = {
        name: 'Test Wall',
        description: 'A'.repeat(2001), // 2001 characters
      };

      const result = CreateWallInput.safeParse(invalidInput);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('2000');
      }
    });

    it('should accept optional description as undefined', () => {
      const validInput = {
        name: 'Test Wall',
        // description is optional
      };

      const result = CreateWallInput.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('should accept empty string description', () => {
      const validInput = {
        name: 'Test Wall',
        description: '',
      };

      const result = CreateWallInput.safeParse(validInput);
      expect(result.success).toBe(true);
    });
  });

  // ============================================================================
  // UpdateWallInput - Description Length Validation
  // ============================================================================

  describe('UpdateWallInput - Description Length', () => {
    it('should accept description under 2000 chars', () => {
      const validInput = {
        description: 'A'.repeat(1500),
      };

      const result = UpdateWallInput.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('should accept description at exactly 2000 chars', () => {
      const validInput = {
        description: 'A'.repeat(2000),
      };

      const result = UpdateWallInput.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('should reject description over 2000 chars', () => {
      const invalidInput = {
        description: 'A'.repeat(2001),
      };

      const result = UpdateWallInput.safeParse(invalidInput);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('2000');
      }
    });

    it('should accept optional description as undefined', () => {
      const validInput = {
        name: 'Updated Name',
      };

      const result = UpdateWallInput.safeParse(validInput);
      expect(result.success).toBe(true);
    });
  });

  // ============================================================================
  // Edge Cases and Combined Validation
  // ============================================================================

  describe('Combined Validation', () => {
    it('should validate complete CreateWallInput with schedule', () => {
      const validInput = {
        name: 'Weekly Prayer Meeting',
        description: 'Join us every Tuesday for prayer',
        is_private: false,
        has_restricted_access: false,
        schedule: {
          frequency: 'weekly' as const,
          day: 'Tuesday',
          time: '19:00',
          timezone: 'America/Chicago',
          duration_minutes: 60,
        },
        video_call_link: 'https://zoom.us/j/123456789',
      };

      const result = CreateWallInput.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('should reject when both timezone and time are invalid', () => {
      const invalidInput = {
        name: 'Test Wall',
        schedule: {
          frequency: 'daily' as const,
          time: '25:70', // Invalid time
          timezone: 'Not/A/Timezone', // Invalid timezone
        },
      };

      const result = CreateWallInput.safeParse(invalidInput);
      expect(result.success).toBe(false);
      if (!result.success) {
        // Should have errors for both time and timezone
        expect(result.error.issues.length).toBeGreaterThanOrEqual(1);
      }
    });
  });
});