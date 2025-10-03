import type { CreatePostInput, UpdatePostInput, Post, PostFilters } from './schemas';

export interface PostRepository {
    create(input: CreatePostInput, authorId: string): Promise<Post>;
    update(id: string, input: UpdatePostInput): Promise<Post | null>;
    delete(id: string): Promise<boolean>;
    findById(id: string): Promise<Post | null>;
    findAll(filters?: PostFilters): Promise<Post[]>;
    findByChurchId(churchId: string): Promise<Post[]>;
    findByAuthorId(authorId: string): Promise<Post[]>;
    getLatestPostInSeries(seriesId: string): Promise<Post | null>;
}