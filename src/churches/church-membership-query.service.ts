import type { IChurchMemberRepository } from './repository';
import { safeExecute } from '../utils/handle-async';
import { logger } from '../logging';

export interface ChurchMembershipInfo {
  churchId: string;
  role: string;
}

export interface IChurchMembershipQueryService {
  getUserChurchMemberships(userId: string): Promise<ChurchMembershipInfo[]>;
}

export class ChurchMembershipQueryService implements IChurchMembershipQueryService {
  constructor(private readonly memberRepository: IChurchMemberRepository) {}

  /**
   * Get all active church memberships for a user
   * @param userId - The user ID to query memberships for
   * @returns Array of church memberships with churchId and role
   */
  async getUserChurchMemberships(userId: string): Promise<ChurchMembershipInfo[]> {
    logger.debug({ userId }, 'Querying user church memberships');

    const [error, members] = await safeExecute(
      this.memberRepository.findByUser(userId, { status: 'Active' })
    );

    if (error) {
      logger.error({ error, userId }, 'Failed to query user church memberships');
      throw error;
    }

    const memberships = members.map((member) => ({
      churchId: member.churchId,
      role: member.role,
    }));

    logger.debug(
      { userId, membershipCount: memberships.length },
      'Retrieved user church memberships'
    );

    return memberships;
  }
}
