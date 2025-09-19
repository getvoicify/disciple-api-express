import { z } from 'zod';
import type { IChurchRepository } from './repository';
import type {
  Church,
  ApprovalInput,
  RejectionInput,
  ChurchFilters
} from './schemas';
import {
  ApprovalInput as ApprovalInputSchema,
  RejectionInput as RejectionInputSchema
} from './schemas';
import {
  NotFoundError,
  BusinessLogicError,
  InvalidFormatError,
  InternalServerError
} from '../utils/errors';

export interface ApprovalHistory {
  churchId: string;
  currentStatus: 'Pending' | 'Approved' | 'Rejected';
  approvedBy: string | null;
  approvedAt: Date | null;
  rejectedBy: string | null;
  rejectedAt: Date | null;
  rejectionReason: string | null;
  createdAt: Date;
  lastUpdated: Date;
}

export interface ChurchApprovalService {
  // Approval operations
  approveChurch(churchId: string, input: ApprovalInput, approverId: string): Promise<Church>;
  rejectChurch(churchId: string, input: RejectionInput, rejectorId: string): Promise<Church>;

  // Query operations
  getPendingChurches(filters?: Partial<ChurchFilters>): Promise<{ churches: Church[]; total: number }>;
  getApprovalHistory(churchId: string): Promise<ApprovalHistory>;
}

export class ChurchApprovalServiceImpl implements ChurchApprovalService {
  constructor(private readonly churchRepository: IChurchRepository) {}

  async approveChurch(churchId: string, input: ApprovalInput, approverId: string): Promise<Church> {
    this.validateUUID(churchId);
    this.validateUUID(approverId);
    const validated = ApprovalInputSchema.parse(input);

    // Find the church
    const church = await this.churchRepository.findById(churchId);
    if (!church) {
      throw new NotFoundError('Church', churchId);
    }

    // Validate current status
    if (church.approvalStatus === 'Approved') {
      throw new BusinessLogicError('Church is already approved', 409);
    }

    if (church.approvalStatus === 'Rejected') {
      throw new BusinessLogicError('Cannot approve a rejected church. Church must be resubmitted first');
    }

    if (church.approvalStatus !== 'Pending') {
      throw new BusinessLogicError('Church must be in pending status to be approved');
    }

    // Perform approval
    const approvalResult = await this.churchRepository.approve(churchId, approverId);
    if (!approvalResult) {
      throw new InternalServerError('Failed to approve church');
    }

    // Return updated church
    const updatedChurch = await this.churchRepository.findById(churchId);
    if (!updatedChurch) {
      throw new InternalServerError('Failed to retrieve updated church');
    }

    return updatedChurch;
  }

  async rejectChurch(churchId: string, input: RejectionInput, rejectorId: string): Promise<Church> {
    this.validateUUID(churchId);
    this.validateUUID(rejectorId);
    const validated = RejectionInputSchema.parse(input);

    // Find the church
    const church = await this.churchRepository.findById(churchId);
    if (!church) {
      throw new NotFoundError('Church', churchId);
    }

    // Validate current status
    if (church.approvalStatus === 'Approved') {
      throw new BusinessLogicError('Cannot reject an approved church');
    }

    if (church.approvalStatus === 'Rejected') {
      throw new BusinessLogicError('Church is already rejected', 409);
    }

    if (church.approvalStatus !== 'Pending') {
      throw new BusinessLogicError('Church must be in pending status to be rejected');
    }

    // Perform rejection
    const rejectionResult = await this.churchRepository.reject(churchId, rejectorId, validated.reason);
    if (!rejectionResult) {
      throw new InternalServerError('Failed to reject church');
    }

    // Return updated church
    const updatedChurch = await this.churchRepository.findById(churchId);
    if (!updatedChurch) {
      throw new InternalServerError('Failed to retrieve updated church');
    }

    return updatedChurch;
  }

  async getPendingChurches(filters?: Partial<ChurchFilters>): Promise<{ churches: Church[]; total: number }> {
    const searchFilters: ChurchFilters = {
      approvalStatus: 'Pending',
      ...filters
    };

    return this.churchRepository.findAll(searchFilters);
  }

  async getApprovalHistory(churchId: string): Promise<ApprovalHistory> {
    this.validateUUID(churchId);

    const church = await this.churchRepository.findById(churchId);
    if (!church) {
      throw new NotFoundError('Church', churchId);
    }

    return {
      churchId: church.id,
      currentStatus: church.approvalStatus,
      approvedBy: church.approvedBy,
      approvedAt: church.approvedAt,
      rejectedBy: church.rejectedBy,
      rejectedAt: church.rejectedAt,
      rejectionReason: church.rejectionReason,
      createdAt: church.createdAt,
      lastUpdated: church.updatedAt
    };
  }

  private validateUUID(id: string): void {
    const uuidSchema = z.string().uuid();
    try {
      uuidSchema.parse(id);
    } catch (error) {
      throw new InvalidFormatError('UUID', 'Valid UUID v4 format');
    }
  }
}