import { describe, it, expect } from 'vitest';
import { existsSync } from 'fs';
import { join } from 'path';

describe('Gallery Repository Interface', () => {
  describe('Gallery Repository Files', () => {
    it('should have gallery repository interface file', () => {
      const repositoryPath = join(process.cwd(), 'src', 'gallery', 'repository.ts');
      expect(existsSync(repositoryPath)).toBe(true);
    });
  });

  describe('GalleryRepository Interface', () => {
    it('should import GalleryRepository interface', async () => {
      const { GalleryRepository } = await import('../../gallery/repository');
      expect(GalleryRepository).toBeDefined();
    });

    it('should have all required repository methods defined in interface', async () => {
      const { GalleryRepository: GalleryRepoConst } = await import('../../gallery/repository');
      const schemasModule = await import('../../gallery/schemas');

      type GalleryRepositoryType = import('../../gallery/repository').GalleryRepository;

      // Mock implementation to test interface compliance
      const mockRepository: GalleryRepositoryType = {
        create: async (churchId) => {
          const mockResult = {
            id: 'generated-uuid',
            churchId,
            createdAt: new Date(),
            updatedAt: new Date()
          };
          return schemasModule.Gallery.parse(mockResult);
        },
        findByChurchId: async (_churchId) => null,
        addMediaItems: async (_galleryId, _items) => {
          return [];
        },
        findById: async (_id) => null,
        removeMediaItem: async (_galleryId, _mediaId) => true,
        getGalleryWithItems: async (_galleryId) => null
      };

      expect(typeof mockRepository.create).toBe('function');
      expect(typeof mockRepository.findByChurchId).toBe('function');
      expect(typeof mockRepository.addMediaItems).toBe('function');
      expect(typeof mockRepository.findById).toBe('function');
      expect(typeof mockRepository.removeMediaItem).toBe('function');
      expect(typeof mockRepository.getGalleryWithItems).toBe('function');

      // Verify the exported const has the expected structure
      expect(GalleryRepoConst.name).toBe('GalleryRepository');
      expect(GalleryRepoConst.methods).toContain('create');
      expect(GalleryRepoConst.methods).toContain('findByChurchId');
      expect(GalleryRepoConst.methods).toContain('addMediaItems');
      expect(GalleryRepoConst.methods).toContain('findById');
      expect(GalleryRepoConst.methods).toContain('removeMediaItem');
      expect(GalleryRepoConst.methods).toContain('getGalleryWithItems');
    });
  });
});