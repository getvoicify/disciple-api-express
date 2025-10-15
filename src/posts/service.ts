import {
    CreatePostInput as CreatePostSchema,
    UpdatePostInput as UpdatePostSchema,
    PostFilters as PostFiltersSchema
} from './schemas';
import { z } from "zod";
import type { PostRepository } from './repository';
import type { CreatePostInput, UpdatePostInput, Post, PostFilters } from './schemas';
import type { ChurchMembershipService } from '../churches/membership-service';
import type { CacheInvalidationService } from '../cache/cache-invalidation.service';
import {
    PostNotFoundError,
    PostUnauthorizedError,
    InsufficientChurchRoleError,
    NotChurchMemberError,
    InactiveMembershipError,
    PostAlreadyPublishedError,
    PostAlreadyDraftError
} from './errors';

export interface PostService {
    createPost(input: CreatePostInput, authorId: string): Promise<Post>;
    updatePost(id: string, input: UpdatePostInput, authorId: string): Promise<Post>;
    deletePost(id: string, authorId: string): Promise<void>;
    getPostById(id: string): Promise<Post>;
    listPosts(filters?: PostFilters): Promise<Post[]>;
    publishPost(id: string, authorId: string): Promise<Post>;
    unpublishPost(id: string, authorId: string): Promise<Post>;
    getLatestPostInSeries(seriesId: string): Promise<Post | null>;
}

export class PostServiceImpl implements PostService {
    constructor(
        private readonly repository: PostRepository,
        private readonly membershipService: ChurchMembershipService,
        private readonly cacheInvalidationService: CacheInvalidationService
    ) {
    }

    async createPost(input: CreatePostInput, authorId: string): Promise<Post> {
        const validated = CreatePostSchema.parse(input);

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

        const post = await this.repository.create(validated, authorId);

        // Invalidate list caches after creating new post
        await this.cacheInvalidationService.invalidateList('post');

        return post;
    }

    async updatePost(id: string, input: UpdatePostInput, authorId: string): Promise<Post> {
        this.validateUUID(id);
        const validated = UpdatePostSchema.parse(input);

        // Check if post exists and user is the author
        const existingPost = await this.repository.findById(id);
        if (!existingPost) {
            throw new PostNotFoundError(id);
        }

        if (existingPost.authorId !== authorId) {
            throw new PostUnauthorizedError('update', id);
        }

        const post = await this.repository.update(id, validated);
        if (!post) {
            throw new PostNotFoundError(id);
        }

        // Invalidate both resource and list caches after updating
        await this.cacheInvalidationService.invalidateResource('post', id);
        await this.cacheInvalidationService.invalidateList('post');

        return post;
    }

    async deletePost(id: string, authorId: string): Promise<void> {
        this.validateUUID(id);

        // Check if post exists and user is the author
        const existingPost = await this.repository.findById(id);
        if (!existingPost) {
            throw new PostNotFoundError(id);
        }

        if (existingPost.authorId !== authorId) {
            throw new PostUnauthorizedError('delete', id);
        }

        const deleted = await this.repository.delete(id);
        if (!deleted) {
            throw new PostNotFoundError(id);
        }

        // Invalidate both resource and list caches after deleting
        await this.cacheInvalidationService.invalidateResource('post', id);
        await this.cacheInvalidationService.invalidateList('post');
    }

    async getPostById(id: string): Promise<Post> {
        this.validateUUID(id);

        const post = await this.repository.findById(id);
        if (!post) {
            throw new PostNotFoundError(id);
        }

        return post;
    }

    async listPosts(filters?: PostFilters): Promise<Post[]> {
        if (filters) {
            const validated = PostFiltersSchema.parse(filters);
            return this.repository.findAll(validated);
        }
        return this.repository.findAll();
    }

    async publishPost(id: string, authorId: string): Promise<Post> {
        this.validateUUID(id);

        // Check if post exists and user is the author
        const existingPost = await this.repository.findById(id);
        if (!existingPost) {
            throw new PostNotFoundError(id);
        }

        if (existingPost.authorId !== authorId) {
            throw new PostUnauthorizedError('publish', id);
        }

        if (existingPost.status === 'published') {
            throw new PostAlreadyPublishedError(id);
        }

        const post = await this.repository.update(id, { status: 'published' });
        if (!post) {
            throw new PostNotFoundError(id);
        }

        // Invalidate both resource and list caches after publishing
        await this.cacheInvalidationService.invalidateResource('post', id);
        await this.cacheInvalidationService.invalidateList('post');

        return post;
    }

    async unpublishPost(id: string, authorId: string): Promise<Post> {
        this.validateUUID(id);

        // Check if post exists and user is the author
        const existingPost = await this.repository.findById(id);
        if (!existingPost) {
            throw new PostNotFoundError(id);
        }

        if (existingPost.authorId !== authorId) {
            throw new PostUnauthorizedError('unpublish', id);
        }

        if (existingPost.status === 'draft') {
            throw new PostAlreadyDraftError(id);
        }

        const post = await this.repository.update(id, { status: 'draft' });
        if (!post) {
            throw new PostNotFoundError(id);
        }

        // Invalidate both resource and list caches after unpublishing
        await this.cacheInvalidationService.invalidateResource('post', id);
        await this.cacheInvalidationService.invalidateList('post');

        return post;
    }

    async getLatestPostInSeries(seriesId: string): Promise<Post | null> {
        this.validateUUID(seriesId);
        return this.repository.getLatestPostInSeries(seriesId);
    }

    private validateUUID(id: string): void {
        const uuidSchema = z.uuid();
        uuidSchema.parse(id);
    }
}