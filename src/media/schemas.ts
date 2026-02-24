import { z } from 'zod';

export const Media = z.object({
    id: z.uuid(),
    filename: z.string().min(1),
    originalFilename: z.string().min(1),
    mimeType: z.string().min(1),
    fileSize: z.number().int().positive(),
    r2Url: z.string().url(),
    r2Key: z.string().min(1),
    uploadedBy: z.uuid(),
    createdAt: z.date(),
    updatedAt: z.date()
});

export const CreateMediaInput = z.object({
    filename: z.string().min(1),
    originalFilename: z.string().min(1),
    mimeType: z.string().min(1),
    fileSize: z.number().int().positive(),
    r2Url: z.string().url(),
    r2Key: z.string().min(1),
    uploadedBy: z.uuid().optional()
});

export const UpdateMediaInput = z.object({
    filename: z.string().min(1).optional(),
    originalFilename: z.string().min(1).optional(),
    mimeType: z.string().min(1).optional(),
    fileSize: z.number().int().positive().optional(),
    r2Url: z.string().url().optional(),
    r2Key: z.string().min(1).optional()
});

export const MediaFilters = z.object({
    uploadedBy: z.string().min(1).optional(),
    mimeType: z.string().optional(),
    filename: z.string().optional(),
    startDate: z.date().optional(),
    endDate: z.date().optional(),
    minFileSize: z.number().int().positive().optional(),
    maxFileSize: z.number().int().positive().optional()
});

export const MediaIdInput = z.object({
    id: z.uuid(),
});

export const PublicMedia = Media.omit({ r2Url: true, r2Key: true });

export type Media = z.infer<typeof Media>;
export type CreateMediaInput = z.infer<typeof CreateMediaInput>;
export type UpdateMediaInput = z.infer<typeof UpdateMediaInput>;
export type MediaFilters = z.infer<typeof MediaFilters>;
export type MediaIdInput = z.infer<typeof MediaIdInput>;
export type PublicMedia = z.infer<typeof PublicMedia>;
