import {z} from 'zod';
import type {IChurchMemberRepository, IChurchRepository} from './repository';
import type {ChurchMember, CreateChurchMemberInput, InvitationInput, MemberRole} from './schemas';
import {InvitationInput as InvitationInputSchema} from './schemas';
import type { UserInfoService } from '../user-info';
import { extractUniqueUserIds, embedUserInfo } from '../user-info/embedding.util';
import type { ChurchInfoService } from '../church-info/service';
import { extractUniqueChurchIds, embedChurchInfo } from '../church-info/embedding.util';
import {
  ChurchNotFoundError,
  ChurchNotApprovedError,
  MemberBannedError,
  MemberAlreadyActiveError,
  MemberInvitedError,
  NotChurchMemberError,
  InactiveMembershipError,
  InsufficientChurchRoleError,
  OwnerInviteError,
  NoInvitationFoundError,
  NoPendingInvitationError,
  OwnerCannotLeaveError,
  TargetNotChurchMemberError,
  CannotRemoveOwnerError,
  CannotBanOwnerError,
  InvalidRoleError,
  CannotChangeOwnerRoleError,
  CannotPromoteToOwnerError,
  MembershipUpdateFailedError,
} from './errors';
import { ValidationError } from '../utils/errors';

export interface ChurchMembershipService {
  // Direct join operations
  joinChurch(churchId: string, userId: string): Promise<ChurchMember>;
  leaveChurch(churchId: string, userId: string): Promise<void>;

  // Invitation operations
  inviteUser(churchId: string, invitation: InvitationInput, inviterId: string): Promise<ChurchMember>;
  acceptInvitation(churchId: string, userId: string): Promise<ChurchMember>;
  declineInvitation(churchId: string, userId: string): Promise<void>;

  // Member management operations
  removeMember(churchId: string, targetUserId: string, actorId: string): Promise<void>;
  banMember(churchId: string, targetUserId: string, actorId: string): Promise<void>;
  updateMemberRole(churchId: string, targetUserId: string, newRole: MemberRole, actorId: string): Promise<ChurchMember>;

  // Query operations
  getChurchMembers(churchId: string, userId: string): Promise<ChurchMember[]>;
  getUserMemberships(userId: string): Promise<ChurchMember[]>;
  getMembershipByUserAndChurch(userId: string, churchId: string): Promise<ChurchMember | null>;
}

export class ChurchMembershipServiceImpl implements ChurchMembershipService {
  constructor(
    private readonly churchRepository: IChurchRepository,
    private readonly memberRepository: IChurchMemberRepository,
    private readonly userInfoService?: UserInfoService,
    private readonly churchInfoService?: ChurchInfoService
  ) {}

  async joinChurch(churchId: string, userId: string): Promise<ChurchMember> {
    this.validateUUID(churchId);
    this.validateUUID(userId);

    // Check if church exists and is approved
    const church = await this.churchRepository.findById(churchId);
    if (!church) {
      throw new ChurchNotFoundError(churchId);
    }

    if (church.approvalStatus !== 'Approved') {
      throw new ChurchNotApprovedError(churchId, church.approvalStatus);
    }

    // Check existing membership
    const existingMembership = await this.memberRepository.findByChurchAndUser(churchId, userId);
    if (existingMembership) {
      if (existingMembership.status === 'Banned') {
        throw new MemberBannedError(churchId, userId);
      }
      if (existingMembership.status === 'Active') {
        return existingMembership; // Already a member
      }
      if (existingMembership.status === 'Invited') {
        return existingMembership; // Has pending invitation
      }
    }

    // Create new membership - church creator becomes owner
    const isChurchCreator = church.createdBy === userId;
    const membershipInput: CreateChurchMemberInput = {
      churchId,
      userId,
      role: isChurchCreator ? 'Owner' : 'Member'
    };

    return this.memberRepository.create(membershipInput);
  }

  async leaveChurch(churchId: string, userId: string): Promise<void> {
    this.validateUUID(churchId);
    this.validateUUID(userId);

    const membership = await this.memberRepository.findByChurchAndUser(churchId, userId);
    if (!membership) {
      throw new NotChurchMemberError(churchId, userId);
    }

    // Owners cannot leave without transferring ownership
    if (membership.role === 'Owner') {
      throw new OwnerCannotLeaveError(churchId, userId);
    }

    await this.memberRepository.updateStatus(membership.id, 'Removed');
  }

  async inviteUser(churchId: string, invitation: InvitationInput, inviterId: string): Promise<ChurchMember> {
    this.validateUUID(churchId);
    this.validateUUID(inviterId);
    const validated = InvitationInputSchema.parse(invitation);
    this.validateUUID(validated.userId);

    // Check if inviter has permission - any church member can invite users
    const inviterMembership = await this.memberRepository.findByChurchAndUser(churchId, inviterId);
    if (!inviterMembership) {
      throw new NotChurchMemberError(churchId, inviterId);
    }

    if (inviterMembership.status !== 'Active') {
      throw new InactiveMembershipError(churchId, inviterId);
    }

    // Determine the role for the invitation
    const inviteRole = validated.role || 'Member';

    // Only owners can invite with Manager or Owner roles
    if (inviteRole !== 'Member' && inviterMembership.role !== 'Owner') {
      throw new InsufficientChurchRoleError(
        'invite users with Manager or Owner roles',
        'Owner',
        inviterMembership.role,
        churchId,
        inviterId
      );
    }

    // Cannot invite someone as Owner (would need ownership transfer)
    if (inviteRole === 'Owner') {
      throw new OwnerInviteError(churchId);
    }

    // Check if user is already a member
    const existingMembership = await this.memberRepository.findByChurchAndUser(churchId, validated.userId);
    if (existingMembership) {
      if (existingMembership.status === 'Active') {
        throw new MemberAlreadyActiveError(churchId, validated.userId);
      }
      if (existingMembership.status === 'Invited') {
        throw new MemberInvitedError(churchId, validated.userId);
      }
    }

    // Create invitation
    const membershipInput: CreateChurchMemberInput = {
      churchId,
      userId: validated.userId,
      role: inviteRole
    };

    return this.memberRepository.create(membershipInput, inviterId);
  }

  async acceptInvitation(churchId: string, userId: string): Promise<ChurchMember> {
    this.validateUUID(churchId);
    this.validateUUID(userId);

    const membership = await this.memberRepository.findByChurchAndUser(churchId, userId);
    if (!membership) {
      throw new NoInvitationFoundError(churchId, userId);
    }

    if (membership.status !== 'Invited') {
      throw new NoPendingInvitationError(churchId, userId);
    }

    await this.memberRepository.updateStatus(membership.id, 'Active');

    const updatedMembership = await this.memberRepository.findById(membership.id);
    if (!updatedMembership) {
      throw new MembershipUpdateFailedError(membership.id, 'update membership status');
    }

    return updatedMembership;
  }

  async declineInvitation(churchId: string, userId: string): Promise<void> {
    this.validateUUID(churchId);
    this.validateUUID(userId);

    const membership = await this.memberRepository.findByChurchAndUser(churchId, userId);
    if (!membership) {
      throw new NoInvitationFoundError(churchId, userId);
    }

    if (membership.status !== 'Invited') {
      throw new NoPendingInvitationError(churchId, userId);
    }

    await this.memberRepository.delete(membership.id);
  }

  async removeMember(churchId: string, targetUserId: string, actorId: string): Promise<void> {
    this.validateUUID(churchId);
    this.validateUUID(targetUserId);
    this.validateUUID(actorId);

    // Check actor permissions
    const actorMembership = await this.memberRepository.findByChurchAndUser(churchId, actorId);
    if (!actorMembership) {
      throw new NotChurchMemberError(churchId, actorId);
    }

    if (actorMembership.role !== 'Owner' && actorMembership.role !== 'Manager') {
      throw new InsufficientChurchRoleError(
        'remove members',
        'Owner or Manager',
        actorMembership.role,
        churchId,
        actorId
      );
    }

    // Check target member
    const targetMembership = await this.memberRepository.findByChurchAndUser(churchId, targetUserId);
    if (!targetMembership) {
      throw new TargetNotChurchMemberError(churchId, targetUserId);
    }

    // Cannot remove owner
    if (targetMembership.role === 'Owner') {
      throw new CannotRemoveOwnerError(churchId, targetUserId);
    }

    await this.memberRepository.updateStatus(targetMembership.id, 'Removed');
  }

  async banMember(churchId: string, targetUserId: string, actorId: string): Promise<void> {
    this.validateUUID(churchId);
    this.validateUUID(targetUserId);
    this.validateUUID(actorId);

    // Check actor permissions
    const actorMembership = await this.memberRepository.findByChurchAndUser(churchId, actorId);
    if (!actorMembership) {
      throw new NotChurchMemberError(churchId, actorId);
    }

    if (actorMembership.role !== 'Owner' && actorMembership.role !== 'Manager') {
      throw new InsufficientChurchRoleError(
        'ban members',
        'Owner or Manager',
        actorMembership.role,
        churchId,
        actorId
      );
    }

    // Check target member
    const targetMembership = await this.memberRepository.findByChurchAndUser(churchId, targetUserId);
    if (!targetMembership) {
      throw new TargetNotChurchMemberError(churchId, targetUserId);
    }

    // Cannot ban owner
    if (targetMembership.role === 'Owner') {
      throw new CannotBanOwnerError(churchId, targetUserId);
    }

    await this.memberRepository.updateStatus(targetMembership.id, 'Banned');
  }

  async updateMemberRole(churchId: string, targetUserId: string, newRole: MemberRole, actorId: string): Promise<ChurchMember> {
    this.validateUUID(churchId);
    this.validateUUID(targetUserId);
    this.validateUUID(actorId);

    // Validate role
    if (!['Owner', 'Manager', 'Member'].includes(newRole)) {
      throw new InvalidRoleError(newRole);
    }

    // Only owners can change roles
    const actorMembership = await this.memberRepository.findByChurchAndUser(churchId, actorId);
    if (!actorMembership) {
      throw new NotChurchMemberError(churchId, actorId);
    }

    if (actorMembership.role !== 'Owner') {
      throw new InsufficientChurchRoleError(
        'change member roles',
        'Owner',
        actorMembership.role,
        churchId,
        actorId
      );
    }

    // Check target member
    const targetMembership = await this.memberRepository.findByChurchAndUser(churchId, targetUserId);
    if (!targetMembership) {
      throw new TargetNotChurchMemberError(churchId, targetUserId);
    }

    // Cannot change owner role
    if (targetMembership.role === 'Owner') {
      throw new CannotChangeOwnerRoleError(churchId, targetUserId);
    }

    // Cannot promote to owner (would need ownership transfer)
    if (newRole === 'Owner') {
      throw new CannotPromoteToOwnerError(churchId, targetUserId);
    }

    await this.memberRepository.updateRole(targetMembership.id, newRole);

    const updatedMembership = await this.memberRepository.findById(targetMembership.id);
    if (!updatedMembership) {
      throw new MembershipUpdateFailedError(targetMembership.id, 'update member role');
    }

    return updatedMembership;
  }

  async getChurchMembers(churchId: string, userId: string): Promise<ChurchMember[]> {
    this.validateUUID(churchId);
    this.validateUUID(userId);

    // Check if user is a member of the church
    const membership = await this.memberRepository.findByChurchAndUser(churchId, userId);
    if (!membership) {
      throw new NotChurchMemberError(churchId, userId);
    }

    // Get active members
    let members = await this.memberRepository.findByChurch(churchId, { status: 'Active' });

    if (members.length === 0) {
      return members;
    }

    // Embed user info if service is available
    if (this.userInfoService) {
      const userIds = extractUniqueUserIds(members, (member) => [member.userId]);
      const userInfoMap = await this.userInfoService.getBatchUserInfo(userIds);

      members = embedUserInfo(
        members,
        userInfoMap,
        (member, userMap) => ({
          ...member,
          user: userMap.get(member.userId),
        })
      );
    }

    // Embed church info if service is available
    if (this.churchInfoService) {
      const churchIds = extractUniqueChurchIds(members, (member) => [member.churchId]);
      const churchInfoMap = await this.churchInfoService.getBatchChurchInfo(churchIds);

      members = embedChurchInfo(
        members,
        churchInfoMap,
        (member, churchMap) => ({
          ...member,
          church: churchMap.get(member.churchId),
        })
      );
    }

    return members;
  }

  async getUserMemberships(userId: string): Promise<ChurchMember[]> {
    this.validateUUID(userId);

    let memberships = await this.memberRepository.findByUser(userId, { status: 'Active' });

    if (memberships.length === 0) {
      return memberships;
    }

    // Embed user info if service is available
    if (this.userInfoService) {
      const userIds = extractUniqueUserIds(memberships, (member) => [member.userId]);
      const userInfoMap = await this.userInfoService.getBatchUserInfo(userIds);

      memberships = embedUserInfo(
        memberships,
        userInfoMap,
        (member, userMap) => ({
          ...member,
          user: userMap.get(member.userId),
        })
      );
    }

    // Embed church info if service is available
    if (this.churchInfoService) {
      const churchIds = extractUniqueChurchIds(memberships, (member) => [member.churchId]);
      const churchInfoMap = await this.churchInfoService.getBatchChurchInfo(churchIds);

      memberships = embedChurchInfo(
        memberships,
        churchInfoMap,
        (member, churchMap) => ({
          ...member,
          church: churchMap.get(member.churchId),
        })
      );
    }

    return memberships;
  }

  async getMembershipByUserAndChurch(userId: string, churchId: string): Promise<ChurchMember | null> {
    this.validateUUID(userId);
    this.validateUUID(churchId);

    return this.memberRepository.findByChurchAndUser(churchId, userId);
  }

  private validateUUID(id: string): void {
    const uuidSchema = z.uuid();
    try {
      uuidSchema.parse(id);
    } catch {
      throw new ValidationError('Invalid UUID format', { id: ['Invalid UUID format'] });
    }
  }
}
