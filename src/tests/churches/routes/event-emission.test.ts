import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ChurchMembershipOutboxAdapter } from '../../../churches/church-membership-outbox.adapter';
import { churchCreateEndpoint } from '../../../churches/routes/churchCreate.endpoint';
import { churchMembershipAcceptInviteEndpoint } from '../../../churches/routes/membership/churchMembershipAcceptInvite.endpoint';
import { churchMembershipLeaveEndpoint } from '../../../churches/routes/membership/churchMembershipLeave.endpoint';
import type { ChurchService } from '../../../churches/service';
import type { ChurchMembershipService } from '../../../churches/membership-service';
import type { Response } from 'express';
import type { EndpointRequest } from '../../../types/endpoint-handler';

/**
 * Tests for church membership event emission
 * Verifies that church membership endpoints correctly emit events to the outbox
 */
describe('Church Membership Event Emission', () => {
  let mockChurchService: ChurchService;
  let mockMembershipService: ChurchMembershipService;
  let mockOutboxAdapter: ChurchMembershipOutboxAdapter;
  let mockRequest: Partial<EndpointRequest>;
  let mockResponse: Partial<Response>;
  let jsonSpy: ReturnType<typeof vi.fn>;
  let statusSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();

    // Mock response
    jsonSpy = vi.fn();
    statusSpy = vi.fn().mockReturnThis();
    mockResponse = {
      json: jsonSpy,
      status: statusSpy,
      send: vi.fn(),
    };

    // Mock church service
    mockChurchService = {
      createChurch: vi.fn(),
    } as unknown as ChurchService;

    // Mock membership service
    mockMembershipService = {
      acceptInvitation: vi.fn(),
      leaveChurch: vi.fn(),
    } as unknown as ChurchMembershipService;

    // Mock outbox adapter
    mockOutboxAdapter = {
      enqueueOwnerCreated: vi.fn(),
      enqueueMemberJoined: vi.fn(),
      enqueueMemberLeft: vi.fn(),
      enqueueOwnershipTransferred: vi.fn(),
    } as unknown as ChurchMembershipOutboxAdapter;

    // Mock request
    mockRequest = {
      body: {},
      params: {},
      user: [
        {},
        {
          payload: {
            sub: '550e8400-e29b-41d4-a716-446655440000',
            email: 'test@example.com',
          },
        },
      ],
    } as unknown as EndpointRequest;
  });

  describe('Church Creation Event', () => {
    it('should emit owner-created event after successful church creation', async () => {
      const churchId = '660e8400-e29b-41d4-a716-446655440001';
      const userId = '550e8400-e29b-41d4-a716-446655440000';
      const createdChurch = {
        id: churchId,
        name: 'Test Church',
        createdBy: userId,
        version: 1,
      };

      mockRequest.body = {
        name: 'Test Church',
        description: 'A test church',
      };

      vi.spyOn(mockChurchService, 'createChurch').mockResolvedValue(createdChurch as any);

      const endpoint = churchCreateEndpoint(mockChurchService, mockOutboxAdapter);
      await endpoint(mockRequest as EndpointRequest, mockResponse as Response);

      // Verify church was created
      expect(mockChurchService.createChurch).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Test Church' }),
        userId
      );

      // Verify event was emitted with correct data
      expect(mockOutboxAdapter.enqueueOwnerCreated).toHaveBeenCalledWith(
        churchId,
        userId,
        expect.any(Object)
      );

      // Verify response was successful
      expect(statusSpy).toHaveBeenCalledWith(201);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: true,
        church: createdChurch,
      });
    });

    it('should NOT emit owner-created event if church creation fails', async () => {
      mockRequest.body = {
        name: 'Test Church',
      };

      vi.spyOn(mockChurchService, 'createChurch').mockRejectedValue(
        new Error('Database error')
      );

      const endpoint = churchCreateEndpoint(mockChurchService, mockOutboxAdapter);
      await endpoint(mockRequest as EndpointRequest, mockResponse as Response);

      // Verify event was NOT emitted
      expect(mockOutboxAdapter.enqueueOwnerCreated).not.toHaveBeenCalled();

      // Verify error response
      expect(statusSpy).toHaveBeenCalledWith(400);
    });
  });

  describe('Invitation Acceptance Event', () => {
    it('should emit member-joined event after successful invitation acceptance', async () => {
      const churchId = '660e8400-e29b-41d4-a716-446655440001';
      const userId = '550e8400-e29b-41d4-a716-446655440000';
      const membership = {
        id: '770e8400-e29b-41d4-a716-446655440002',
        churchId,
        userId,
        role: 'Member' as const,
        status: 'Active' as const,
      };

      mockRequest.params = { churchId };

      vi.spyOn(mockMembershipService, 'acceptInvitation').mockResolvedValue(membership as any);

      const endpoint = churchMembershipAcceptInviteEndpoint(mockMembershipService, mockOutboxAdapter);
      await endpoint(mockRequest as EndpointRequest, mockResponse as Response);

      // Verify invitation was accepted
      expect(mockMembershipService.acceptInvitation).toHaveBeenCalledWith(churchId, userId);

      // Verify event was emitted with correct data
      expect(mockOutboxAdapter.enqueueMemberJoined).toHaveBeenCalledWith(
        churchId,
        userId,
        'Member',
        expect.any(Object)
      );

      // Verify response was successful
      expect(jsonSpy).toHaveBeenCalledWith({
        success: true,
        membership,
      });
    });

    it('should emit member-joined event with Manager role when user joins as Manager', async () => {
      const churchId = '660e8400-e29b-41d4-a716-446655440001';
      const userId = '550e8400-e29b-41d4-a716-446655440000';
      const membership = {
        id: '770e8400-e29b-41d4-a716-446655440002',
        churchId,
        userId,
        role: 'Manager' as const,
        status: 'Active' as const,
      };

      mockRequest.params = { churchId };

      vi.spyOn(mockMembershipService, 'acceptInvitation').mockResolvedValue(membership as any);

      const endpoint = churchMembershipAcceptInviteEndpoint(mockMembershipService, mockOutboxAdapter);
      await endpoint(mockRequest as EndpointRequest, mockResponse as Response);

      // Verify event includes Manager role
      expect(mockOutboxAdapter.enqueueMemberJoined).toHaveBeenCalledWith(
        churchId,
        userId,
        'Manager',
        expect.any(Object)
      );
    });

    it('should NOT emit member-joined event if invitation acceptance fails', async () => {
      const churchId = '660e8400-e29b-41d4-a716-446655440001';
      mockRequest.params = { churchId };

      vi.spyOn(mockMembershipService, 'acceptInvitation').mockRejectedValue(
        new Error('No pending invitation found')
      );

      const endpoint = churchMembershipAcceptInviteEndpoint(mockMembershipService, mockOutboxAdapter);
      await endpoint(mockRequest as EndpointRequest, mockResponse as Response);

      // Verify event was NOT emitted
      expect(mockOutboxAdapter.enqueueMemberJoined).not.toHaveBeenCalled();

      // Verify error response
      expect(statusSpy).toHaveBeenCalled();
    });
  });

  describe('Leave Church Event', () => {
    it('should emit member-left event after successfully leaving church', async () => {
      const churchId = '660e8400-e29b-41d4-a716-446655440001';
      const userId = '550e8400-e29b-41d4-a716-446655440000';

      mockRequest.params = { churchId };

      vi.spyOn(mockMembershipService, 'leaveChurch').mockResolvedValue(undefined);

      const endpoint = churchMembershipLeaveEndpoint(mockMembershipService, mockOutboxAdapter);
      await endpoint(mockRequest as EndpointRequest, mockResponse as Response);

      // Verify leave was processed
      expect(mockMembershipService.leaveChurch).toHaveBeenCalledWith(churchId, userId);

      // Verify event was emitted with correct data
      expect(mockOutboxAdapter.enqueueMemberLeft).toHaveBeenCalledWith(
        churchId,
        userId,
        expect.any(Object)
      );

      // Verify 204 No Content response
      expect(statusSpy).toHaveBeenCalledWith(204);
    });

    it('should NOT emit member-left event if leave fails', async () => {
      const churchId = '660e8400-e29b-41d4-a716-446655440001';
      mockRequest.params = { churchId };

      vi.spyOn(mockMembershipService, 'leaveChurch').mockRejectedValue(
        new Error('You are not a member of this church')
      );

      const endpoint = churchMembershipLeaveEndpoint(mockMembershipService, mockOutboxAdapter);
      await endpoint(mockRequest as EndpointRequest, mockResponse as Response);

      // Verify event was NOT emitted
      expect(mockOutboxAdapter.enqueueMemberLeft).not.toHaveBeenCalled();

      // Verify error response
      expect(statusSpy).toHaveBeenCalled();
    });
  });

  describe('Event Payload Structure', () => {
    it('should include metadata in owner-created event', async () => {
      const churchId = '660e8400-e29b-41d4-a716-446655440001';
      const userId = '550e8400-e29b-41d4-a716-446655440000';
      const createdChurch = {
        id: churchId,
        name: 'Test Church',
        createdBy: userId,
        version: 1,
      };

      mockRequest.body = { name: 'Test Church' };

      vi.spyOn(mockChurchService, 'createChurch').mockResolvedValue(createdChurch as any);

      const endpoint = churchCreateEndpoint(mockChurchService, mockOutboxAdapter);
      await endpoint(mockRequest as EndpointRequest, mockResponse as Response);

      // Verify metadata object is passed
      expect(mockOutboxAdapter.enqueueOwnerCreated).toHaveBeenCalledWith(
        churchId,
        userId,
        expect.objectContaining({
          churchName: 'Test Church',
        })
      );
    });

    it('should include metadata in member-joined event', async () => {
      const churchId = '660e8400-e29b-41d4-a716-446655440001';
      const userId = '550e8400-e29b-41d4-a716-446655440000';
      const membership = {
        id: '770e8400-e29b-41d4-a716-446655440002',
        churchId,
        userId,
        role: 'Member' as const,
        status: 'Active' as const,
      };

      mockRequest.params = { churchId };

      vi.spyOn(mockMembershipService, 'acceptInvitation').mockResolvedValue(membership as any);

      const endpoint = churchMembershipAcceptInviteEndpoint(mockMembershipService, mockOutboxAdapter);
      await endpoint(mockRequest as EndpointRequest, mockResponse as Response);

      // Verify metadata object is passed
      expect(mockOutboxAdapter.enqueueMemberJoined).toHaveBeenCalledWith(
        churchId,
        userId,
        'Member',
        expect.objectContaining({
          membershipId: membership.id,
        })
      );
    });
  });
});
