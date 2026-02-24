import { z } from 'zod';
import { UserInfoSchema } from '../user-info/schemas';

// Enums
export const ApprovalStatus = z.enum(['Pending', 'Approved', 'Rejected']);
export const MemberRole = z.enum(['Owner', 'Manager', 'Member']);
export const MemberStatus = z.enum(['Active', 'Invited', 'Removed', 'Banned']);
export const Visibility = z.enum(['Public', 'Hidden']);

// Address schema
export const Address = z.object({
	street: z.string().optional(),
	city: z.string().optional(),
	state: z.string().optional(),
	zipCode: z.string().optional(),
	country: z.string().optional()
}).optional();

// Social Links schema
export const SocialLinks = z.object({
	facebook: z.url().startsWith('https://').optional(),
	instagram: z.url().startsWith('https://').optional(),
	twitterX: z.url().startsWith('https://').optional(),
	youtube: z.url().startsWith('https://').optional(),
	tiktok: z.url().startsWith('https://').optional(),
	other: z.array(z.url().startsWith('https://')).optional()
}).optional();

// Church schema
export const Church = z.object({
	id: z.uuid(),
	slug: z.string().min(1).max(255),
	name: z.string().min(2).max(100),
	description: z.string().max(2000).optional().nullable(),
	logoUrl: z.url().startsWith('https://').optional().nullable(),
	coverImageUrl: z.url().startsWith('https://').optional().nullable(),
	byline: z.string().max(160).optional().nullable(),
	missionStatement: z.string().max(2000).optional().nullable(),
	address: Address.nullable(),
	latitude: z.number().min(-90).max(90).optional().nullable(),
	longitude: z.number().min(-180).max(180).optional().nullable(),
	email: z.email().optional().nullable(),
	phoneNumber: z.string().optional().nullable(),
	websiteUrl: z.url().startsWith('https://').optional().nullable(),
	socialLinks: SocialLinks.nullable(),
	approvalStatus: ApprovalStatus,
	approvedBy: z.uuid().optional().nullable(),
	approvedAt: z.date().optional().nullable(),
	rejectedBy: z.uuid().optional().nullable(),
	rejectedAt: z.date().optional().nullable(),
	rejectionReason: z.string().optional().nullable(),
	createdBy: z.uuid(),
	createdAt: z.date(),
	updatedAt: z.date(),
	version: z.number().int().positive(),
	visibility: Visibility
});

// Create Church Input
export const CreateChurchInput = z.object({
	name: z.string().min(2).max(100),
	description: z.string().max(2000).optional(),
	logoUrl: z.url().startsWith('https://').optional(),
	coverImageUrl: z.url().startsWith('https://').optional(),
	byline: z.string().max(160).optional(),
	missionStatement: z.string().max(2000).optional(),
	address: Address,
	latitude: z.number().min(-90).max(90).optional(),
	longitude: z.number().min(-180).max(180).optional(),
	email: z.email().optional(),
	phoneNumber: z.string().optional(),
	websiteUrl: z.url().startsWith('https://').optional(),
	socialLinks: SocialLinks
});

// Update Church Input
export const UpdateChurchInput = z.object({
	name: z.string().min(2).max(100).optional(),
	description: z.string().max(2000).optional(),
	logoUrl: z.url().startsWith('https://').optional(),
	coverImageUrl: z.url().startsWith('https://').optional(),
	byline: z.string().max(160).optional(),
	missionStatement: z.string().max(2000).optional(),
	address: Address,
	latitude: z.number().min(-90).max(90).optional(),
	longitude: z.number().min(-180).max(180).optional(),
	email: z.email().optional(),
	phoneNumber: z.string().optional(),
	websiteUrl: z.url().startsWith('https://').optional(),
	socialLinks: SocialLinks
}).partial();

// Church Filters
export const ChurchFilters = z.object({
	name: z.string().optional(),
	approvalStatus: ApprovalStatus.optional(),
	visibility: Visibility.optional(),
	nearLatitude: z.number().min(-90).max(90).optional(),
	nearLongitude: z.number().min(-180).max(180).optional(),
	radius: z.number().positive().optional(), // in kilometers
	createdBy: z.uuid().optional(),
	page: z.number().int().positive().default(1).optional(),
	pageSize: z.number().int().positive().max(100).default(20).optional(),
	sortBy: z.enum(['created_at', 'name', 'slug', 'approval_status']).optional(),
	sortOrder: z.enum(['asc', 'desc']).default('desc').optional(),
});

// Church Member schema
export const ChurchMember = z.object({
	id: z.uuid(),
	churchId: z.uuid(),
	userId: z.uuid(),
	role: MemberRole,
	status: MemberStatus,
	joinedAt: z.date(),
	updatedAt: z.date(),
	invitedBy: z.uuid().optional().nullable(),
	invitedAt: z.date().optional().nullable(),
	user: UserInfoSchema.optional()
});

// Create Church Member Input
export const CreateChurchMemberInput = z.object({
	churchId: z.uuid(),
	userId: z.uuid(),
	role: MemberRole.default('Member')
});

// Update Church Member Input
export const UpdateChurchMemberInput = z.object({
	role: MemberRole.optional(),
	status: MemberStatus.optional()
});

// Approval Input
export const ApprovalInput = z.object({
	reason: z.string().optional()
});

// Rejection Input
export const RejectionInput = z.object({
	reason: z.string().min(1)
});

// Invitation Input
export const InvitationInput = z.object({
	userId: z.uuid(),
	role: MemberRole.default('Member').optional()
});

export const ChurchIdInput = z.object({
	churchId: z.uuid(),
})

export const UserIdInput = z.object({
	userId: z.uuid(),
})

export const UpdateRoleInput = z.object({
	role: MemberRole,
})

export const ChurchFetchInput = ChurchIdInput;
export const ChurchDeleteInput = ChurchIdInput;
export const ChurchUpdateParamsInput = ChurchIdInput;
export const ChurchUpdateInput = UpdateChurchInput.extend({ version: z.number() });
export const PendingChurchListQueryInput = z.object({
	page: z.coerce.number().int().positive().optional(),
	pageSize: z.coerce.number().int().positive().max(100).optional(),
	name: z.string().optional().nullable(),
});

// Type exports
export type ApprovalStatus = z.infer<typeof ApprovalStatus>;
export type MemberRole = z.infer<typeof MemberRole>;
export type MemberStatus = z.infer<typeof MemberStatus>;
export type Visibility = z.infer<typeof Visibility>;
export type Address = z.infer<typeof Address>;
export type SocialLinks = z.infer<typeof SocialLinks>;
export type Church = z.infer<typeof Church>;
export type CreateChurchInput = z.infer<typeof CreateChurchInput>;
export type UpdateChurchInput = z.infer<typeof UpdateChurchInput>;
export type ChurchFilters = z.infer<typeof ChurchFilters>;
export type ChurchMember = z.infer<typeof ChurchMember>;
export type CreateChurchMemberInput = z.infer<typeof CreateChurchMemberInput>;
export type UpdateChurchMemberInput = z.infer<typeof UpdateChurchMemberInput>;
export type ApprovalInput = z.infer<typeof ApprovalInput>;
export type RejectionInput = z.infer<typeof RejectionInput>;
export type InvitationInput = z.infer<typeof InvitationInput>;
