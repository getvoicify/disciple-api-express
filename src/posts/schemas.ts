import { z } from 'zod';
import { UserInfoSchema } from '../user-info/schemas';

// Reuse ScriptureReference from notes
export const ScriptureReference = z.object({
    book: z.string().min(1),
    chapter: z.number().int().positive(),
    verse: z.number().int().positive(),
    endVerse: z.number().int().positive().optional()
});

// Post status enum
export const PostStatus = z.enum(['draft', 'published']);

// Post schema
export const Post = z.object({
    id: z.uuid(),
    title: z.string().min(1).max(255),
    content: z.string().min(1),
    authorId: z.uuid(),
    churchId: z.uuid(),
    status: PostStatus,
    publishedAt: z.date().nullable(),
    image: z.string().nullable(),
    tags: z.array(z.string()),
    categories: z.array(z.string()),
    scriptureReferences: z.array(ScriptureReference),
    seriesId: z.uuid().nullable(),
    seriesName: z.string().nullable(),
    author: UserInfoSchema.optional(),
    createdAt: z.date(),
    updatedAt: z.date()
});

// Create Post Input
export const CreatePostInput = z.object({
    title: z.string().min(1).max(255),
    content: z.string().min(1),
    churchId: z.uuid(),
    image: z.string().url().optional(),
    tags: z.array(z.string()).optional(),
    categories: z.array(z.string()).optional(),
    scriptureReferences: z.array(ScriptureReference).optional(),
    seriesId: z.uuid().optional(),
    seriesName: z.string().optional()
});

// Update Post Input
export const UpdatePostInput = z.object({
    title: z.string().min(1).max(255).optional(),
    content: z.string().min(1).optional(),
    status: PostStatus.optional(),
    image: z.string().url().optional(),
    tags: z.array(z.string()).optional(),
    categories: z.array(z.string()).optional(),
    scriptureReferences: z.array(ScriptureReference).optional(),
    seriesId: z.uuid().optional(),
    seriesName: z.string().optional()
});

// Post Filters
export const PostFilters = z.object({
    authorizedIds: z.array(z.uuid()).default([]).optional(),
    churchId: z.uuid().optional(),
    authorId: z.uuid().optional(),
    status: PostStatus.optional(),
    seriesId: z.uuid().optional(),
    tags: z.array(z.string()).optional(),
    categories: z.array(z.string()).optional(),
    startDate: z.date().optional(),
    endDate: z.date().optional(),
    scripture: z.object({
        book: z.string().optional(),
        chapter: z.number().int().positive().optional(),
        verse: z.number().int().positive().optional()
    }).optional()
});

// Type exports
export type ScriptureReference = z.infer<typeof ScriptureReference>;
export type PostStatus = z.infer<typeof PostStatus>;
export type Post = z.infer<typeof Post>;
export type CreatePostInput = z.infer<typeof CreatePostInput>;
export type UpdatePostInput = z.infer<typeof UpdatePostInput>;
export type PostFilters = z.infer<typeof PostFilters>;