import type { CreateMediaInput, UpdateMediaInput, Media, MediaFilters } from './schemas';

export interface MediaRepository {
    create(input: CreateMediaInput, uploadedBy: string): Promise<Media>;
    update(id: string, input: UpdateMediaInput): Promise<Media | null>;
    delete(id: string): Promise<boolean>;
    findById(id: string): Promise<Media | null>;
    findAll(filters?: MediaFilters): Promise<Media[]>;
    findByUploadedBy(uploadedBy: string): Promise<Media[]>;
}

// Export for testing - can be used to check interface structure
export const MediaRepository = {
    name: 'MediaRepository',
    methods: ['create', 'update', 'delete', 'findById', 'findAll', 'findByUploadedBy']
} as const;