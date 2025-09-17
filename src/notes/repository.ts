import type { CreateNoteInput, UpdateNoteInput, Note, NoteFilters } from './schemas';

export interface NoteRepository {
    create(input: CreateNoteInput, ownerId: string): Promise<Note>;
    update(id: string, input: UpdateNoteInput): Promise<Note | null>;
    delete(id: string): Promise<boolean>;
    findById(id: string): Promise<Note | null>;
    findAll(filters?: NoteFilters): Promise<Note[]>;
}