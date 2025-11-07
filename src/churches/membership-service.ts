import {z} from 'zod';
import type {IChurchMemberRepository, IChurchRepository} from './repository';
import type {ChurchMember, CreateChurchMemberInput, InvitationInput, MemberRole} from './schemas';
import {InvitationInput as InvitationInputSchema} from './schemas';
import type { UserInfoService } from '../user-info/service';
import { extractUniqueUserIds, embedUserInfo } from '../user-info/embedding.util';

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
    private readonly userInfoService?: UserInfoService
  ) {}

  async joinChurch(churchId: string, userId: string): Promise<ChurchMember> {
    this.validateUUID(churchId);
    this.validateUUID(userId);

    // Check if church exists and is approved
    const church = await this.churchRepository.findById(churchId);
    if (!church) {
      throw new Error('Church not found');
    }

    if (church.approvalStatus !== 'Approved') {
      throw new Error('Cannot join church that is not approved');
    }

    // Check existing membership
    const existingMembership = await this.memberRepository.findByChurchAndUser(churchId, userId);
    if (existingMembership) {
      if (existingMembership.status === 'Banned') {
        throw new Error('You are banned from this church');
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
      throw new Error('You are not a member of this church');
    }

    // Owners cannot leave without transferring ownership
    if (membership.role === 'Owner') {
      throw new Error('Owner cannot leave church without transferring ownership first');
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
      throw new Error('You are not a member of this church');
    }

    if (inviterMembership.status !== 'Active') {
      throw new Error('Only active church members can invite users');
    }

    // Determine the role for the invitation
    const inviteRole = validated.role || 'Member';

    // Only owners can invite with Manager or Owner roles
    if (inviteRole !== 'Member' && inviterMembership.role !== 'Owner') {
      throw new Error('Only church owners can invite users with Manager or Owner roles');
    }

    // Cannot invite someone as Owner (would need ownership transfer)
    if (inviteRole === 'Owner') {
      throw new Error('Cannot invite user as Owner. Use ownership transfer instead');
    }

    // Check if user is already a member
    const existingMembership = await this.memberRepository.findByChurchAndUser(churchId, validated.userId);
    if (existingMembership) {
      if (existingMembership.status === 'Active' || existingMembership.status === 'Invited') {
        throw new Error('User is already a member of this church');
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
      throw new Error('No invitation found');
    }

    if (membership.status !== 'Invited') {
      throw new Error('No pending invitation found');
    }

    await this.memberRepository.updateStatus(membership.id, 'Active');

    const updatedMembership = await this.memberRepository.findById(membership.id);
    if (!updatedMembership) {
      throw new Error('Failed to update membership status');
    }

    return updatedMembership;
  }

  async declineInvitation(churchId: string, userId: string): Promise<void> {
    this.validateUUID(churchId);
    this.validateUUID(userId);

    const membership = await this.memberRepository.findByChurchAndUser(churchId, userId);
    if (!membership) {
      throw new Error('No invitation found');
    }

    if (membership.status !== 'Invited') {
      throw new Error('No pending invitation found');
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
      throw new Error('You are not a member of this church');
    }

    if (actorMembership.role !== 'Owner' && actorMembership.role !== 'Manager') {
      throw new Error('Only owners and managers can remove members');
    }

    // Check target member
    const targetMembership = await this.memberRepository.findByChurchAndUser(churchId, targetUserId);
    if (!targetMembership) {
      throw new Error('Target user is not a member of this church');
    }

    // Cannot remove owner
    if (targetMembership.role === 'Owner') {
      throw new Error('Cannot remove church owner');
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
      throw new Error('You are not a member of this church');
    }

    if (actorMembership.role !== 'Owner' && actorMembership.role !== 'Manager') {
      throw new Error('Only owners and managers can ban members');
    }

    // Check target member
    const targetMembership = await this.memberRepository.findByChurchAndUser(churchId, targetUserId);
    if (!targetMembership) {
      throw new Error('Target user is not a member of this church');
    }

    // Cannot ban owner
    if (targetMembership.role === 'Owner') {
      throw new Error('Cannot ban church owner');
    }

    await this.memberRepository.updateStatus(targetMembership.id, 'Banned');
  }

  async updateMemberRole(churchId: string, targetUserId: string, newRole: MemberRole, actorId: string): Promise<ChurchMember> {
    this.validateUUID(churchId);
    this.validateUUID(targetUserId);
    this.validateUUID(actorId);

    // Validate role
    if (!['Owner', 'Manager', 'Member'].includes(newRole)) {
      throw new Error('Invalid role');
    }

    // Only owners can change roles
    const actorMembership = await this.memberRepository.findByChurchAndUser(churchId, actorId);
    if (!actorMembership) {
      throw new Error('You are not a member of this church');
    }

    if (actorMembership.role !== 'Owner') {
      throw new Error('Only church owner can change member roles');
    }

    // Check target member
    const targetMembership = await this.memberRepository.findByChurchAndUser(churchId, targetUserId);
    if (!targetMembership) {
      throw new Error('Target user is not a member of this church');
    }

    // Cannot change owner role
    if (targetMembership.role === 'Owner') {
      throw new Error('Cannot change church owner role');
    }

    // Cannot promote to owner (would need ownership transfer)
    if (newRole === 'Owner') {
      throw new Error('Cannot promote to owner role. Use ownership transfer instead');
    }

    await this.memberRepository.updateRole(targetMembership.id, newRole);

    const updatedMembership = await this.memberRepository.findById(targetMembership.id);
    if (!updatedMembership) {
      throw new Error('Failed to update member role');
    }

    return updatedMembership;
  }

  async getChurchMembers(churchId: string, userId: string): Promise<ChurchMember[]> {
    this.validateUUID(churchId);
    this.validateUUID(userId);

    // Check if user is a member of the church
    const membership = await this.memberRepository.findByChurchAndUser(churchId, userId);
    if (!membership) {
      throw new Error('You are not a member of this church');
    }

    // Get active members
    const members = await this.memberRepository.findByChurch(churchId, { status: 'Active' });

    // Embed user info if service is available
    if (!this.userInfoService || members.length === 0) {
      return members;
    }

    const userIds = extractUniqueUserIds(members, (member) => [member.userId]);
    const userInfoMap = await this.userInfoService.getBatchUserInfo(userIds);

    return embedUserInfo(
      members,
      userInfoMap,
      (member, userMap) => ({
        ...member,
        user: userMap.get(member.userId),
      })
    );
  }

  async getUserMemberships(userId: string): Promise<ChurchMember[]> {
    this.validateUUID(userId);

    return this.memberRepository.findByUser(userId, { status: 'Active' });
  }

  async getMembershipByUserAndChurch(userId: string, churchId: string): Promise<ChurchMember | null> {
    this.validateUUID(userId);
    this.validateUUID(churchId);

    return this.memberRepository.findByChurchAndUser(churchId, userId);
  }

  private validateUUID(id: string): void {
    const uuidSchema = z.string().uuid();
    try {
      uuidSchema.parse(id);
    } catch {
      throw new Error('Invalid UUID format');
    }
  }
}
