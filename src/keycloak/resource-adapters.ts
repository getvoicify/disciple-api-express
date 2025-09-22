import { Note } from "../notes/schemas";
import { Outbox } from "../outbox";
import {
	GeneralizedKeycloakOutboxAdapter,
	SpecializedKeycloakAdapter,
	Resource,
	ResourceConfig,
	KeycloakResourcePermissions
} from "./generalized-outbox.adapter";

// Define Church resource interface
export interface Church extends Resource {
	id: string;
	name: string;
	ownerId: string;
	memberCount?: number;
	createdAt: Date;
	updatedAt: Date;
}

// Define Event resource interface
export interface Event extends Resource {
	id: string;
	title: string;
	churchId: string;
	startDate: Date;
	endDate: Date;
	organizerId: string;
}

// Define User resource interface
export interface User extends Resource {
	id: string;
	email: string;
	name: string;
	role: string;
}

/**
 * Factory class for creating resource-specific Keycloak adapters
 */
export class KeycloakAdapterFactory {
	private generalizedAdapter: GeneralizedKeycloakOutboxAdapter;

	constructor(outbox: Outbox<any>) {
		// Initialize with custom resource configurations
		const customConfigs: ResourceConfig[] = [
			{
				type: 'note',
				validScopes: ['read', 'update', 'delete', 'share', 'comment'],
				defaultPermissions: {
					read: [],
					update: [],
					delete: [],
					share: [],
					comment: []
				},
				validateResource: (resource: Resource) => {
					const note = resource as Note;
					return !!note.id && !!note.content;
				}
			},
			{
				type: 'church',
				validScopes: ['read', 'update', 'delete', 'manage', 'invite', 'moderate'],
				defaultPermissions: {
					read: [],
					update: [],
					delete: [],
					manage: [],
					invite: [],
					moderate: []
				},
				validateResource: (resource: Resource) => {
					const church = resource as Church;
					return !!church.id && !!church.name && !!church.ownerId;
				}
			},
			{
				type: 'event',
				validScopes: ['read', 'update', 'delete', 'register', 'manage', 'invite'],
				defaultPermissions: {
					read: [],
					update: [],
					delete: [],
					register: [],
					manage: [],
					invite: []
				},
				validateResource: (resource: Resource) => {
					const event = resource as Event;
					return !!event.id && !!event.title && !!event.churchId;
				},
				transformResource: (resource: Resource) => {
					const event = resource as Event;
					// Add computed properties or transformations
					return {
						...event,
						duration: event.endDate.getTime() - event.startDate.getTime()
					};
				}
			},
			{
				type: 'user',
				validScopes: ['read', 'update', 'delete', 'impersonate', 'admin'],
				defaultPermissions: {
					read: [],
					update: [],
					delete: []
				},
				validateResource: (resource: Resource) => {
					const user = resource as User;
					return !!user.id && !!user.email;
				}
			}
		];

		this.generalizedAdapter = new GeneralizedKeycloakOutboxAdapter(outbox, customConfigs);
	}

	/**
	 * Get the generalized adapter for direct use
	 */
	getGeneralizedAdapter(): GeneralizedKeycloakOutboxAdapter {
		return this.generalizedAdapter;
	}

	/**
	 * Create a Note-specific adapter
	 */
	createNoteAdapter(): SpecializedKeycloakAdapter<Note> {
		return this.generalizedAdapter.createSpecializedAdapter<Note>('note');
	}

	/**
	 * Create a Church-specific adapter
	 */
	createChurchAdapter(): SpecializedKeycloakAdapter<Church> {
		return this.generalizedAdapter.createSpecializedAdapter<Church>('church');
	}

	/**
	 * Create an Event-specific adapter
	 */
	createEventAdapter(): SpecializedKeycloakAdapter<Event> {
		return this.generalizedAdapter.createSpecializedAdapter<Event>('event');
	}

	/**
	 * Create a User-specific adapter
	 */
	createUserAdapter(): SpecializedKeycloakAdapter<User> {
		return this.generalizedAdapter.createSpecializedAdapter<User>('user');
	}

	/**
	 * Create a custom resource adapter
	 */
	createCustomAdapter<T extends Resource>(
		resourceType: string,
		config?: Partial<ResourceConfig>
	): SpecializedKeycloakAdapter<T> {
		return this.generalizedAdapter.createSpecializedAdapter<T>(resourceType, config);
	}
}

/**
 * Example usage class showing how to use the adapters
 */
export class KeycloakResourceService {
	private noteAdapter: SpecializedKeycloakAdapter<Note>;
	private churchAdapter: SpecializedKeycloakAdapter<Church>;
	private eventAdapter: SpecializedKeycloakAdapter<Event>;
	private userAdapter: SpecializedKeycloakAdapter<User>;

	constructor(factory: KeycloakAdapterFactory) {
		this.noteAdapter = factory.createNoteAdapter();
		this.churchAdapter = factory.createChurchAdapter();
		this.eventAdapter = factory.createEventAdapter();
		this.userAdapter = factory.createUserAdapter();
	}

	/**
	 * Example: Create a note with Keycloak permissions
	 */
	async createNoteWithPermissions(
		note: Note,
		ownerId: string,
		sharedWith?: string[]
	): Promise<void> {
		await this.noteAdapter.create(note, ownerId, {
			sharedReadWith: sharedWith,
			metadata: {
				createdBy: 'notes-service',
				version: '1.0.0'
			}
		});
	}

	/**
	 * Example: Share a note with additional users
	 */
	async shareNote(noteId: string, userIds: string[]): Promise<void> {
		for (const userId of userIds) {
			await this.noteAdapter.grantPermission(
				noteId,
				userId,
				['read', 'comment'],
				{ action: 'share', timestamp: Date.now() }
			);
		}
	}

	/**
	 * Example: Create a church with owner permissions
	 */
	async createChurch(church: Church): Promise<void> {
		await this.churchAdapter.create(church, church.ownerId, {
			metadata: {
				source: 'church-management',
				initialMemberCount: church.memberCount || 1
			}
		});
	}

	/**
	 * Example: Add church managers
	 */
	async addChurchManager(churchId: string, managerId: string): Promise<void> {
		await this.churchAdapter.grantPermission(
			churchId,
			managerId,
			['read', 'update', 'manage', 'invite'],
			{ role: 'manager' }
		);
	}

	/**
	 * Example: Create an event with permissions
	 */
	async createEvent(event: Event, allowRegistrations: string[] = []): Promise<void> {
		await this.eventAdapter.create(event, event.organizerId, {
			sharedReadWith: allowRegistrations,
			metadata: {
				churchId: event.churchId,
				eventType: 'worship-service'
			}
		});

		// Grant registration permissions to allowed users
		for (const userId of allowRegistrations) {
			await this.eventAdapter.grantPermission(
				event.id,
				userId,
				['register'],
				{ grantedAt: Date.now() }
			);
		}
	}

	/**
	 * Example: Transfer church ownership
	 */
	async transferChurchOwnership(
		churchId: string,
		currentOwnerId: string,
		newOwnerId: string
	): Promise<void> {
		await this.churchAdapter.transferOwnership(
			churchId,
			currentOwnerId,
			newOwnerId,
			{
				reason: 'ownership-transfer',
				transferredAt: Date.now()
			}
		);
	}

	/**
	 * Example: Delete a resource
	 */
	async deleteNote(noteId: string, deletedBy: string): Promise<void> {
		await this.noteAdapter.delete(noteId, {
			deletedBy,
			deletedAt: Date.now(),
			reason: 'user-requested'
		});
	}

	/**
	 * Example: Bulk update church permissions
	 */
	async updateChurchPermissions(
		churchId: string,
		members: string[],
		managers: string[],
		owner: string
	): Promise<void> {
		await this.churchAdapter.updatePermissions(
			churchId,
			{
				read: [...members, ...managers, owner],
				update: [...managers, owner],
				delete: [owner],
				manage: [...managers, owner],
				invite: [...managers, owner],
				moderate: [...managers, owner]
			},
			{
				updatedBy: owner,
				updatedAt: Date.now()
			}
		);
	}

	/**
	 * Example: Complex permission scenario
	 */
	async setupEventWithComplexPermissions(
		event: Event,
		churchMembers: string[],
		eventManagers: string[],
		vipGuests: string[]
	): Promise<void> {
		// Create event with initial permissions
		await this.eventAdapter.create(event, event.organizerId, {
			sharedReadWith: [...churchMembers, ...vipGuests],
			metadata: {
				eventType: 'special-service',
				expectedAttendees: churchMembers.length + vipGuests.length
			}
		});

		// Grant management permissions to event managers
		for (const managerId of eventManagers) {
			await this.eventAdapter.grantPermission(
				event.id,
				managerId,
				['read', 'update', 'manage', 'invite'],
				{ role: 'event-manager' }
			);
		}

		// Grant special permissions to VIP guests
		for (const guestId of vipGuests) {
			await this.eventAdapter.grantPermission(
				event.id,
				guestId,
				['read', 'register'],
				{ role: 'vip-guest', priority: true }
			);
		}

		// Grant basic registration to church members
		for (const memberId of churchMembers) {
			await this.eventAdapter.grantPermission(
				event.id,
				memberId,
				['register'],
				{ role: 'church-member' }
			);
		}
	}
}