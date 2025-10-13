import { z } from 'zod';
import type { IChurchRepository } from './repository';
import type {
  CreateChurchInput,
  UpdateChurchInput,
  ChurchFilters,
  Church
} from './schemas';
import {
  CreateChurchInput as CreateChurchSchema,
  UpdateChurchInput as UpdateChurchSchema,
  ChurchFilters as ChurchFiltersSchema
} from './schemas';
import {
  NotFoundError,
  ValidationError,
  ConflictError,
  MissingRequiredFieldError,
  InvalidFormatError
} from '../utils/errors';

export interface ChurchService {
  createChurch(input: CreateChurchInput, ownerId: string): Promise<Church>;
  updateChurch(id: string, input: UpdateChurchInput, version: number): Promise<Church>;
  deleteChurch(id: string): Promise<void>;
  getChurchById(id: string): Promise<Church>;
  getChurchBySlug(slug: string): Promise<Church>;
  listChurches(filters?: ChurchFilters): Promise<{ churches: Church[]; total: number }>;
  listChurchesPublic(filters?: Partial<ChurchFilters>): Promise<{ churches: Church[]; total: number }>;
  searchChurches(query: string): Promise<{ churches: Church[]; total: number }>;
  submitForApproval(id: string, version: number): Promise<Church>;
}

export class ChurchServiceImpl implements ChurchService {
  constructor(private readonly repository: IChurchRepository) {}

  async createChurch(input: CreateChurchInput, ownerId: string): Promise<Church> {
    // Validate input
    const validated = CreateChurchSchema.parse(input);

    // Validate owner ID
    this.validateUUID(ownerId);
    if (!ownerId || ownerId.trim() === '') {
      throw new MissingRequiredFieldError('Owner ID');
    }

    return this.repository.create(validated, ownerId);
  }

  async updateChurch(id: string, input: UpdateChurchInput, version: number): Promise<Church> {
    // Validate inputs
    this.validateUUID(id);
    const validated = UpdateChurchSchema.parse(input);

    if (typeof version !== 'number' || version < 1) {
      throw new ValidationError('Valid version is required for optimistic locking');
    }

    const church = await this.repository.update(id, validated, version);
    if (!church) {
      throw new ConflictError('Church not found or version conflict');
    }

    return church;
  }

  async deleteChurch(id: string): Promise<void> {
    this.validateUUID(id);

    const deleted = await this.repository.delete(id);
    if (!deleted) {
      throw new NotFoundError('Church', id);
    }
  }

  async getChurchById(id: string): Promise<Church> {
    this.validateUUID(id);

    const church = await this.repository.findById(id);
    if (!church) {
      throw new NotFoundError('Church', id);
    }

    return church;
  }

  async getChurchBySlug(slug: string): Promise<Church> {
    if (!slug || slug.trim() === '') {
      throw new MissingRequiredFieldError('Slug');
    }

    const church = await this.repository.findBySlug(slug);
    if (!church) {
      throw new NotFoundError('Church', slug);
    }

    return church;
  }

  async listChurches(filters?: ChurchFilters): Promise<{ churches: Church[]; total: number }> {
    if (filters) {
      const validated = ChurchFiltersSchema.parse(filters);
      return this.repository.findAll(validated);
    }
    return this.repository.findAll();
  }

  async listChurchesPublic(filters?: Partial<ChurchFilters>): Promise<{ churches: Church[]; total: number }> {
    // For public access, always enforce these base filters
    const publicFilters: ChurchFilters = {
      approvalStatus: 'Approved',
      visibility: 'Public',
      ...filters // Allow overriding with user-provided filters
    };

    // Security: If someone explicitly requests Hidden churches, return empty
    if (filters?.visibility === 'Hidden') {
      return { churches: [], total: 0 };
    }

    // Security: Don't allow public users to see non-approved churches
    if (filters?.approvalStatus && filters.approvalStatus !== 'Approved') {
      return { churches: [], total: 0 };
    }

    return this.repository.findAll(publicFilters);
  }

  async searchChurches(query: string): Promise<{ churches: Church[]; total: number }> {
    if (!query || query.trim() === '') {
      return { churches: [], total: 0 };
    }

    return this.repository.findAll({ name: query.trim() });
  }

  async submitForApproval(id: string, version: number): Promise<Church> {
    this.validateUUID(id);

    if (typeof version !== 'number' || version < 1) {
      throw new ValidationError('Valid version is required for optimistic locking');
    }

    // Clear rejection data when resubmitting
    const updateInput: UpdateChurchInput = {
      // Additional logic could be added here to clear rejection fields
      // For now, we'll let the repository handle the approval status change
    };

    const church = await this.repository.update(id, updateInput, version);
    if (!church) {
      throw new ConflictError('Church not found or version conflict');
    }

    return church;
  }

  private validateUUID(id: string): void {
    const uuidSchema = z.uuid();
    try {
      uuidSchema.parse(id);
    } catch {
      throw new InvalidFormatError('UUID', 'Valid UUID v4 format');
    }
  }
}
