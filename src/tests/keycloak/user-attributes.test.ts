import { beforeEach, describe, expect, it, vi } from 'vitest';
import { KeycloakAdminClientImpl, type KeycloakAdminConfig } from '../../keycloak/admin-client';
import type { MemberRole } from '../../churches/schemas';

// Mock fetch globally
global.fetch = vi.fn();

describe('Keycloak User Attributes Management', () => {
  let adminClient: KeycloakAdminClientImpl;
  const mockConfig: KeycloakAdminConfig = {
    keycloakUrl: 'https://keycloak.example.com/realms/test',
    realm: 'test',
    clientId: 'test-client',
    clientSecret: 'test-secret',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    adminClient = new KeycloakAdminClientImpl(mockConfig);

    // Mock token endpoint
    (global.fetch as any).mockImplementation((url: string) => {
      if (url.includes('/protocol/openid-connect/token')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              access_token: 'mock-token',
              expires_in: 3600,
              token_type: 'Bearer',
            }),
        });
      }
      return Promise.reject(new Error('Unexpected URL'));
    });
  });

  describe('getUserAttributes', () => {
    it('should fetch user attributes from Keycloak', async () => {
      const userId = 'user-123';
      const mockAttributes = {
        church_membership: JSON.stringify([
          { churchId: 'church-1', role: 'Owner' },
          { churchId: 'church-2', role: 'Member' },
        ]),
      };

      (global.fetch as any).mockImplementation((url: string) => {
        if (url.includes('/protocol/openid-connect/token')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                access_token: 'mock-token',
                expires_in: 3600,
                token_type: 'Bearer',
              }),
          });
        }
        if (url.includes(`/users/${userId}`)) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                id: userId,
                attributes: mockAttributes,
              }),
          });
        }
        return Promise.reject(new Error('Unexpected URL'));
      });

      const attributes = await adminClient.getUserAttributes(userId);

      expect(attributes).toEqual(mockAttributes);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining(`/users/${userId}`),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Bearer mock-token',
          }),
        })
      );
    });

    it('should return empty object when user has no attributes', async () => {
      const userId = 'user-no-attrs';

      (global.fetch as any).mockImplementation((url: string) => {
        if (url.includes('/protocol/openid-connect/token')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                access_token: 'mock-token',
                expires_in: 3600,
                token_type: 'Bearer',
              }),
          });
        }
        if (url.includes(`/users/${userId}`)) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                id: userId,
                attributes: {},
              }),
          });
        }
        return Promise.reject(new Error('Unexpected URL'));
      });

      const attributes = await adminClient.getUserAttributes(userId);

      expect(attributes).toEqual({});
    });

    it('should throw error when user not found', async () => {
      const userId = 'user-not-found';

      (global.fetch as any).mockImplementation((url: string) => {
        if (url.includes('/protocol/openid-connect/token')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                access_token: 'mock-token',
                expires_in: 3600,
                token_type: 'Bearer',
              }),
          });
        }
        if (url.includes(`/users/${userId}`)) {
          return Promise.resolve({
            ok: false,
            status: 404,
            statusText: 'Not Found',
          });
        }
        return Promise.reject(new Error('Unexpected URL'));
      });

      await expect(adminClient.getUserAttributes(userId)).rejects.toThrow('User not found');
    });
  });

  describe('updateUserAttributes', () => {
    it('should update user attributes in Keycloak', async () => {
      const userId = 'user-123';
      const existingUser = {
        id: userId,
        username: 'testuser',
        email: 'test@example.com',
        attributes: {
          existing_attribute: 'existing_value',
        },
      };
      const newAttributes = {
        church_membership: JSON.stringify([
          { churchId: 'church-1', role: 'Owner' },
        ]),
      };

      (global.fetch as any).mockImplementation((url: string, options?: any) => {
        if (url.includes('/protocol/openid-connect/token')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                access_token: 'mock-token',
                expires_in: 3600,
                token_type: 'Bearer',
              }),
          });
        }
        if (url.includes(`/users/${userId}`) && options?.method === 'GET') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(existingUser),
          });
        }
        if (url.includes(`/users/${userId}`) && options?.method === 'PUT') {
          return Promise.resolve({
            ok: true,
            status: 204,
          });
        }
        return Promise.reject(new Error('Unexpected URL'));
      });

      await expect(
        adminClient.updateUserAttributes(userId, newAttributes)
      ).resolves.not.toThrow();

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining(`/users/${userId}`),
        expect.objectContaining({
          method: 'PUT',
          headers: expect.objectContaining({
            Authorization: 'Bearer mock-token',
            'Content-Type': 'application/json',
          }),
          body: expect.stringContaining('church_membership'),
        })
      );
    });

    it('should throw error when update fails', async () => {
      const userId = 'user-123';
      const existingUser = {
        id: userId,
        username: 'testuser',
        email: 'test@example.com',
        attributes: {
          existing_attribute: 'existing_value',
        },
      };
      const newAttributes = {
        church_membership: '[]',
      };

      (global.fetch as any).mockImplementation((url: string, options?: any) => {
        if (url.includes('/protocol/openid-connect/token')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                access_token: 'mock-token',
                expires_in: 3600,
                token_type: 'Bearer',
              }),
          });
        }
        if (url.includes(`/users/${userId}`) && options?.method === 'GET') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(existingUser),
          });
        }
        if (url.includes(`/users/${userId}`) && options?.method === 'PUT') {
          return Promise.resolve({
            ok: false,
            status: 500,
            statusText: 'Internal Server Error',
          });
        }
        return Promise.reject(new Error('Unexpected URL'));
      });

      await expect(
        adminClient.updateUserAttributes(userId, newAttributes)
      ).rejects.toThrow('Failed to update user attributes');
    });
  });

  describe('church membership attribute transformer', () => {
    it('should serialize church membership array to JSON string', () => {
      const memberships: Array<{ churchId: string; role: MemberRole }> = [
        { churchId: 'church-1', role: 'Owner' },
        { churchId: 'church-2', role: 'Member' },
      ];

      const serialized = JSON.stringify(memberships);

      expect(serialized).toContain('church-1');
      expect(serialized).toContain('Owner');
      expect(serialized).toContain('church-2');
      expect(serialized).toContain('Member');
    });

    it('should parse JSON string back to typed array', () => {
      const jsonString = JSON.stringify([
        { churchId: 'church-1', role: 'Owner' },
        { churchId: 'church-2', role: 'Manager' },
      ]);

      const parsed = JSON.parse(jsonString);

      expect(parsed).toHaveLength(2);
      expect(parsed[0]).toEqual({ churchId: 'church-1', role: 'Owner' });
      expect(parsed[1]).toEqual({ churchId: 'church-2', role: 'Manager' });
    });

    it('should handle empty array correctly', () => {
      const emptyMemberships: Array<{ churchId: string; role: MemberRole }> = [];
      const serialized = JSON.stringify(emptyMemberships);

      expect(serialized).toBe('[]');

      const parsed = JSON.parse(serialized);
      expect(parsed).toEqual([]);
      expect(parsed).toHaveLength(0);
    });
  });
});
