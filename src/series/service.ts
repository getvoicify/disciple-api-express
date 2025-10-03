import {
  CreateSeriesInput as CreateSeriesSchema,
  UpdateSeriesInput as UpdateSeriesSchema,
  SeriesFilters as SeriesFiltersSchema
} from './schemas';
import { z } from "zod";
import type { SeriesRepository } from './repository';
import type { CreateSeriesInput, UpdateSeriesInput, Series, SeriesFilters } from './schemas';
import type { ChurchMembershipService } from '../churches/membership-service';
import type { PostRepository } from '../posts/repository';
import type { Post } from '../posts/schemas';
import {
  SeriesNotFoundError,
  SeriesUnauthorizedError,
} from './errors';
import {
  InsufficientChurchRoleError,
  NotChurchMemberError,
  InactiveMembershipError,
} from '../posts/errors';

export interface DailyDevotionals {
  [date: string]: Post[];
}

export interface SeriesService {
  createSeries(input: CreateSeriesInput, authorId: string): Promise<Series>;
  updateSeries(id: string, input: UpdateSeriesInput, authorId: string): Promise<Series>;
  deleteSeries(id: string, authorId: string): Promise<void>;
  getSeriesById(id: string): Promise<Series>;
  listSeries(filters?: SeriesFilters): Promise<Series[]>;
  publishSeries(id: string, authorId: string): Promise<Series>;
  unpublishSeries(id: string, authorId: string): Promise<Series>;
  getDailyDevotionals(userId: string): Promise<DailyDevotionals>;
}

export class SeriesServiceImpl implements SeriesService {
  constructor(
    private readonly repository: SeriesRepository,
    private readonly membershipService: ChurchMembershipService,
    private readonly postRepository: PostRepository
  ) {
  }

  async createSeries(input: CreateSeriesInput, authorId: string): Promise<Series> {
    const validated = CreateSeriesSchema.parse(input);

    // Verify user is a member of the church
    const membership = await this.membershipService.getMembershipByUserAndChurch(
      authorId,
      validated.churchId
    );

    if (!membership) {
      throw new NotChurchMemberError(authorId, validated.churchId);
    }

    // Verify membership is active
    if (membership.status !== 'Active') {
      throw new InactiveMembershipError(membership.status);
    }

    // Verify user is owner or manager
    if (membership.role !== 'Owner' && membership.role !== 'Manager') {
      throw new InsufficientChurchRoleError(['Owner', 'Manager'], membership.role);
    }

    return this.repository.create(validated, authorId);
  }

  async updateSeries(id: string, input: UpdateSeriesInput, authorId: string): Promise<Series> {
    this.validateUUID(id);
    const validated = UpdateSeriesSchema.parse(input);

    // Check if series exists and user is the author
    const existingSeries = await this.repository.findById(id);
    if (!existingSeries) {
      throw new SeriesNotFoundError(id);
    }

    if (existingSeries.authorId !== authorId) {
      throw new SeriesUnauthorizedError('update', id);
    }

    const series = await this.repository.update(id, validated);
    if (!series) {
      throw new SeriesNotFoundError(id);
    }

    return series;
  }

  async deleteSeries(id: string, authorId: string): Promise<void> {
    this.validateUUID(id);

    // Check if series exists and user is the author
    const existingSeries = await this.repository.findById(id);
    if (!existingSeries) {
      throw new SeriesNotFoundError(id);
    }

    if (existingSeries.authorId !== authorId) {
      throw new SeriesUnauthorizedError('delete', id);
    }

    const deleted = await this.repository.delete(id);
    if (!deleted) {
      throw new SeriesNotFoundError(id);
    }
  }

  async getSeriesById(id: string): Promise<Series> {
    this.validateUUID(id);

    const series = await this.repository.findById(id);
    if (!series) {
      throw new SeriesNotFoundError(id);
    }

    return series;
  }

  async listSeries(filters?: SeriesFilters): Promise<Series[]> {
    if (filters) {
      const validated = SeriesFiltersSchema.parse(filters);
      return this.repository.findAll(validated);
    }
    return this.repository.findAll();
  }

  async publishSeries(id: string, authorId: string): Promise<Series> {
    this.validateUUID(id);

    // Check if series exists and user is the author
    const existingSeries = await this.repository.findById(id);
    if (!existingSeries) {
      throw new SeriesNotFoundError(id);
    }

    if (existingSeries.authorId !== authorId) {
      throw new SeriesUnauthorizedError('publish', id);
    }

    const series = await this.repository.update(id, { status: 'published' });
    if (!series) {
      throw new SeriesNotFoundError(id);
    }

    return series;
  }

  async unpublishSeries(id: string, authorId: string): Promise<Series> {
    this.validateUUID(id);

    // Check if series exists and user is the author
    const existingSeries = await this.repository.findById(id);
    if (!existingSeries) {
      throw new SeriesNotFoundError(id);
    }

    if (existingSeries.authorId !== authorId) {
      throw new SeriesUnauthorizedError('unpublish', id);
    }

    const series = await this.repository.update(id, { status: 'draft' });
    if (!series) {
      throw new SeriesNotFoundError(id);
    }

    return series;
  }

  async getDailyDevotionals(userId: string): Promise<DailyDevotionals> {
    this.validateUUID(userId);

    // Get all user's church memberships
    const memberships = await this.membershipService.getUserMemberships(userId);

    if (memberships.length === 0) {
      return {};
    }

    // Extract church IDs
    const churchIds = memberships.map(m => m.churchId);

    // Get all published series for user's churches
    const series = await this.repository.findAll({
      authorizedIds: churchIds,
      status: 'published'
    });

    if (series.length === 0) {
      return {};
    }

    // Get latest post for each series
    const postPromises = series.map(s => this.postRepository.getLatestPostInSeries(s.id));
    const posts = await Promise.all(postPromises);

    // Filter out null posts and group by date
    const devotionals: DailyDevotionals = {};

    posts.forEach(post => {
      if (post && post.publishedAt) {
        // Format date as YYYY-MM-DD
        const dateKey = post.publishedAt.toISOString().split('T')[0];

        if (!devotionals[dateKey]) {
          devotionals[dateKey] = [];
        }

        devotionals[dateKey].push(post);
      }
    });

    return devotionals;
  }

  private validateUUID(id: string): void {
    const uuidSchema = z.uuid();
    uuidSchema.parse(id);
  }
}