import {
    CreateNoteInput as CreateNoteSchema,
    UpdateNoteInput as UpdateNoteSchema,
    NoteFilters as NoteFiltersSchema
} from './schemas';
import {z} from "zod";
import type {NoteRepository} from './repository';
import type {CreateNoteInput, UpdateNoteInput, Note, NoteFilters} from './schemas';
import type {ICacheInvalidationService} from '../cache/cache-invalidation.service';
import type { UserInfoService } from '../user-info/service';
import { extractUniqueUserIds, embedUserInfo } from '../user-info/embedding.util';

export interface NoteService {
    createNote(input: CreateNoteInput, ownerId: string): Promise<Note>;

    updateNote(id: string, input: UpdateNoteInput): Promise<Note>;

    deleteNote(id: string): Promise<void>;

    getNoteById(id: string): Promise<Note>;

    listNotes(filters?: NoteFilters): Promise<Note[]>;

    searchNotesByContent(query: string): Promise<Note[]>;

    filterNotesByDateRange(startDate: Date, endDate: Date): Promise<Note[]>;

    filterNotesByScripture(book: string, chapter?: number, verse?: number): Promise<Note[]>;
}

export class NoteServiceImpl implements NoteService {
    constructor(
        private readonly repository: NoteRepository,
        private readonly cacheInvalidationService: ICacheInvalidationService,
        private readonly userInfoService?: UserInfoService
    ) {
    }

    async createNote(input: CreateNoteInput, ownerId: string): Promise<Note> {
        const validated = CreateNoteSchema.parse(input);
        const note = await this.repository.create(validated, ownerId);

        // Invalidate list caches after creating new note
        await this.cacheInvalidationService.invalidateList('note');

        return note;
    }

    async updateNote(id: string, input: UpdateNoteInput): Promise<Note> {
        this.validateUUID(id);
        const validated = UpdateNoteSchema.parse(input);

        const note = await this.repository.update(id, validated);
        if (!note) {
            throw new Error('Note not found');
        }

        // Invalidate both resource and list caches after updating
        await this.cacheInvalidationService.invalidateResource('note', id);
        await this.cacheInvalidationService.invalidateList('note');

        return note;
    }

    async deleteNote(id: string): Promise<void> {
        this.validateUUID(id);

        const deleted = await this.repository.delete(id);
        if (!deleted) {
            throw new Error('Note not found');
        }

        // Invalidate both resource and list caches after deleting
        await this.cacheInvalidationService.invalidateResource('note', id);
        await this.cacheInvalidationService.invalidateList('note');
    }

    async getNoteById(id: string): Promise<Note> {
        this.validateUUID(id);

        const note = await this.repository.findById(id);
        if (!note) {
            throw new Error('Note not found');
        }

        return note;
    }

    async listNotes(filters?: NoteFilters): Promise<Note[]> {
        let notes: Note[];
        if (filters) {
            const validated = NoteFiltersSchema.parse(filters);
            notes = await this.repository.findAll(validated);
        } else {
            notes = await this.repository.findAll();
        }

        if (!this.userInfoService || notes.length === 0) {
            return notes;
        }

        const ownerIds = extractUniqueUserIds(notes, (note) => note.ownerId ? [note.ownerId] : []);
        if (ownerIds.length === 0) {
            return notes;
        }

        const userInfoMap = await this.userInfoService.getBatchUserInfo(ownerIds);

        return embedUserInfo(
            notes,
            userInfoMap,
            (note, userMap) => ({
                ...note,
                owner: note.ownerId ? userMap.get(note.ownerId) : undefined,
            })
        );
    }

    async searchNotesByContent(query: string): Promise<Note[]> {
        if (!query || query.trim() === '') {
            return [];
        }

        return this.repository.findAll({content: query});
    }

    async filterNotesByDateRange(startDate: Date, endDate: Date): Promise<Note[]> {
        if (startDate > endDate) {
            throw new Error('Invalid date range: start date must be before end date');
        }

        return this.repository.findAll({startDate, endDate});
    }

    async filterNotesByScripture(book: string, chapter?: number, verse?: number): Promise<Note[]> {
        const scripture: any = {book};
        if (chapter !== undefined) {
            scripture.chapter = chapter;
        }
        if (verse !== undefined) {
            scripture.verse = verse;
        }

        return this.repository.findAll({scripture});
    }

    private validateUUID(id: string): void {
        const uuidSchema = z.uuid();
        uuidSchema.parse(id);
    }
}