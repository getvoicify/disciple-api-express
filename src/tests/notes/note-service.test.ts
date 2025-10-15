import { beforeEach, describe, expect, it, vi } from 'vitest';
import { type NoteService, NoteServiceImpl } from '../../notes/service';
import type { NoteRepository } from '../../notes/repository';
import type { CreateNoteInput, Note, UpdateNoteInput } from '../../notes/schemas';
import type { CacheInvalidationService } from '../../cache/cache-invalidation.service';

// Mock repository
const createMockRepository = () => ({
	create: vi.fn(),
	update: vi.fn(),
	delete: vi.fn(),
	findById: vi.fn(),
	findAll: vi.fn(),
});

// Mock cache invalidation service
const createMockCacheInvalidationService = () => ({
	invalidateResource: vi.fn(),
	invalidateList: vi.fn(),
	invalidateAll: vi.fn(),
});

describe('NoteService', () => {
	let mockRepository: ReturnType<typeof createMockRepository>;
	let mockCacheInvalidationService: ReturnType<typeof createMockCacheInvalidationService>;
	let service: NoteService;

	beforeEach(() => {
		mockRepository = createMockRepository();
		mockCacheInvalidationService = createMockCacheInvalidationService();
		service = new NoteServiceImpl(
			mockRepository as unknown as NoteRepository,
			mockCacheInvalidationService as unknown as CacheInvalidationService
		);
	});

	describe('createNote', () => {
		it('should create note and invalidate list cache', async () => {
			const input: CreateNoteInput = {
				title: 'Test Note',
				content: 'Test content'
			};
			const ownerId = '550e8400-e29b-41d4-a716-446655440001';

			const mockNote: Note = {
				id: '550e8400-e29b-41d4-a716-446655440002',
				title: input.title,
				content: input.content,
				ownerId,
				scripture: null,
				tags: [],
				createdAt: new Date(),
				updatedAt: new Date()
			};

			mockRepository.create.mockResolvedValue(mockNote);

			const result = await service.createNote(input, ownerId);

			expect(mockRepository.create).toHaveBeenCalledWith(input, ownerId);
			expect(mockCacheInvalidationService.invalidateList).toHaveBeenCalledWith('note');
			expect(result).toEqual(mockNote);
		});
	});

	describe('updateNote', () => {
		it('should update note and invalidate resource + list caches', async () => {
			const noteId = '550e8400-e29b-41d4-a716-446655440003';
			const updateInput: UpdateNoteInput = {
				title: 'Updated Title'
			};

			const mockUpdatedNote: Note = {
				id: noteId,
				title: 'Updated Title',
				content: 'Content',
				ownerId: '550e8400-e29b-41d4-a716-446655440001',
				scripture: null,
				tags: [],
				createdAt: new Date(),
				updatedAt: new Date()
			};

			mockRepository.update.mockResolvedValue(mockUpdatedNote);

			const result = await service.updateNote(noteId, updateInput);

			expect(mockRepository.update).toHaveBeenCalledWith(noteId, updateInput);
			expect(mockCacheInvalidationService.invalidateResource).toHaveBeenCalledWith('note', noteId);
			expect(mockCacheInvalidationService.invalidateList).toHaveBeenCalledWith('note');
			expect(result).toEqual(mockUpdatedNote);
		});

		it('should throw error when note not found', async () => {
			const noteId = '550e8400-e29b-41d4-a716-446655440004';
			const updateInput: UpdateNoteInput = { title: 'Updated' };

			mockRepository.update.mockResolvedValue(null);

			await expect(service.updateNote(noteId, updateInput)).rejects.toThrow('Note not found');

			expect(mockRepository.update).toHaveBeenCalledWith(noteId, updateInput);
		});
	});

	describe('deleteNote', () => {
		it('should delete note and invalidate resource + list caches', async () => {
			const noteId = '550e8400-e29b-41d4-a716-446655440005';

			mockRepository.delete.mockResolvedValue(true);

			await service.deleteNote(noteId);

			expect(mockRepository.delete).toHaveBeenCalledWith(noteId);
			expect(mockCacheInvalidationService.invalidateResource).toHaveBeenCalledWith('note', noteId);
			expect(mockCacheInvalidationService.invalidateList).toHaveBeenCalledWith('note');
		});

		it('should throw error when note not found', async () => {
			const noteId = '550e8400-e29b-41d4-a716-446655440006';

			mockRepository.delete.mockResolvedValue(false);

			await expect(service.deleteNote(noteId)).rejects.toThrow('Note not found');

			expect(mockRepository.delete).toHaveBeenCalledWith(noteId);
		});
	});

	describe('getNoteById', () => {
		it('should return note when found', async () => {
			const noteId = '550e8400-e29b-41d4-a716-446655440007';

			const mockNote: Note = {
				id: noteId,
				title: 'Title',
				content: 'Content',
				ownerId: '550e8400-e29b-41d4-a716-446655440001',
				scripture: null,
				tags: [],
				createdAt: new Date(),
				updatedAt: new Date()
			};

			mockRepository.findById.mockResolvedValue(mockNote);

			const result = await service.getNoteById(noteId);

			expect(mockRepository.findById).toHaveBeenCalledWith(noteId);
			expect(result).toEqual(mockNote);
		});

		it('should throw error when note not found', async () => {
			const noteId = '550e8400-e29b-41d4-a716-446655440008';

			mockRepository.findById.mockResolvedValue(null);

			await expect(service.getNoteById(noteId)).rejects.toThrow('Note not found');
		});
	});

	describe('listNotes', () => {
		it('should return list of notes', async () => {
			const mockNotes: Note[] = [
				{
					id: '550e8400-e29b-41d4-a716-446655440009',
					title: 'Note 1',
					content: 'Content 1',
					ownerId: '550e8400-e29b-41d4-a716-44665544000a',
					scripture: null,
					tags: [],
					createdAt: new Date(),
					updatedAt: new Date()
				}
			];

			mockRepository.findAll.mockResolvedValue(mockNotes);

			const result = await service.listNotes();

			expect(mockRepository.findAll).toHaveBeenCalled();
			expect(result).toEqual(mockNotes);
		});

		it('should pass filters to repository', async () => {
			const filters = {
				ownerId: '550e8400-e29b-41d4-a716-446655440001'
			};

			mockRepository.findAll.mockResolvedValue([]);

			await service.listNotes(filters);

			// NoteFiltersSchema transforms ownerId input to authorizedIds output
			// The schema sets authorizedIds to empty array by default
			// Actual authorization logic happens in the repository layer
			expect(mockRepository.findAll).toHaveBeenCalledWith({
				authorizedIds: []
			});
		});
	});
});