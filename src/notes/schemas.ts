import { z } from 'zod';
import { UserInfoSchema } from '../user-info/schemas';

export const ScriptureReference = z.object({
    book: z.string().min(1),
    chapter: z.number().int().positive(),
    verse: z.number().int().positive(),
    endVerse: z.number().int().positive().optional()
});

export const Note = z.object({
    id: z.uuid(),
    title: z.string().min(1),
    content: z.string(),
    date: z.date(),
    scriptureReferences: z.array(ScriptureReference),
    images: z.array(z.string()).optional(),
    owner: UserInfoSchema.optional(),
    createdAt: z.date(),
    updatedAt: z.date()
});

export const CreateNoteInput = z.object({
    title: z.string().min(1),
    content: z.string(),
    scriptureReferences: z.array(ScriptureReference).optional(),
    images: z.array(z.string()).optional()
});

export const UpdateNoteInput = z.object({
    title: z.string().min(1).optional(),
    content: z.string().optional(),
    scriptureReferences: z.array(ScriptureReference).optional(),
    images: z.array(z.string()).optional()
});

export const NoteFilters = z.object({
		authorizedIds: z.array(z.string()).default([]).optional(),
    title: z.string().optional(),
    content: z.string().optional(),
    startDate: z.date().optional(),
    endDate: z.date().optional(),
    scripture: z.object({
        book: z.string().optional(),
        chapter: z.number().int().positive().optional(),
        verse: z.number().int().positive().optional()
    }).optional(),
});

export type Note = z.infer<typeof Note>;
export type CreateNoteInput = z.infer<typeof CreateNoteInput>;
export type UpdateNoteInput = z.infer<typeof UpdateNoteInput>;
export type NoteFilters = z.infer<typeof NoteFilters>;
export type ScriptureReference = z.infer<typeof ScriptureReference>;
