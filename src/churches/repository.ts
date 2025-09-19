import type {
	Church,
	CreateChurchInput,
	UpdateChurchInput,
	ChurchFilters,
	ChurchMember,
	CreateChurchMemberInput,
	UpdateChurchMemberInput,
	MemberRole,
	MemberStatus
} from './schemas';

// Church Repository Interface
export interface IChurchRepository {
	// CRUD operations
	create(input: CreateChurchInput, ownerId: string): Promise<Church>;
	update(id: string, input: UpdateChurchInput, version: number): Promise<Church | null>;
	delete(id: string): Promise<boolean>;
	findById(id: string): Promise<Church | null>;
	findBySlug(slug: string): Promise<Church | null>;
	findAll(filters?: ChurchFilters): Promise<{ churches: Church[]; total: number }>;

	// Approval operations
	approve(id: string, approverId: string): Promise<boolean>;
	reject(id: string, rejectorId: string, reason: string): Promise<boolean>;

	// Slug operations
	checkSlugExists(slug: string): Promise<boolean>;
	generateUniqueSlug(name: string): Promise<string>;
}

// Church Member Repository Interface
export interface IChurchMemberRepository {
	// CRUD operations
	create(input: CreateChurchMemberInput, invitedBy?: string): Promise<ChurchMember>;
	update(id: string, input: UpdateChurchMemberInput): Promise<ChurchMember | null>;
	delete(id: string): Promise<boolean>;
	findById(id: string): Promise<ChurchMember | null>;

	// Query operations
	findByChurchAndUser(churchId: string, userId: string): Promise<ChurchMember | null>;
	findByChurch(churchId: string, filters?: { role?: MemberRole; status?: MemberStatus }): Promise<ChurchMember[]>;
	findByUser(userId: string, filters?: { status?: MemberStatus }): Promise<ChurchMember[]>;

	// Status and role operations
	updateRole(id: string, role: MemberRole): Promise<boolean>;
	updateStatus(id: string, status: MemberStatus): Promise<boolean>;
}
