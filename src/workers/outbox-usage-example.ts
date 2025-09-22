import { getOutbox, OutboxSingleton } from './outbox-singleton';
import { KeycloakAdapterFactory } from '../keycloak/resource-adapters';
import { Note } from '../notes/schemas';

/**
 * Example usage of the Outbox singleton in your application
 */
export class OutboxUsageExample {
	/**
	 * Example 1: Using the Outbox directly
	 */
	async useOutboxDirectly() {
		// Get the singleton Outbox instance
		const outbox = await getOutbox();

		// Enqueue a Keycloak resource creation event
		await outbox.enqueueCreate('keycloak_resource', 'note_123', {
			type: 'keycloak.resource.create',
			payload: {
				resourceId: 'note_123',
				resourceType: 'note',
				ownerId: 'user_456',
				permissions: {
					read: ['user_456'],
					update: ['user_456'],
					delete: ['user_456']
				}
			}
		});

		// Enqueue a permission grant event
		await outbox.enqueueUpdate('keycloak_resource', 'note_123', {
			type: 'keycloak.permission.grant',
			payload: {
				resourceId: 'note_123',
				resourceType: 'note',
				granteeId: 'user_789',
				scopes: ['read']
			}
		});

		// Enqueue a resource deletion event
		await outbox.enqueueDelete('keycloak_resource', 'note_123', {
			type: 'keycloak.resource.delete',
			payload: {
				resourceId: 'note_123',
				resourceType: 'note'
			}
		});
	}

	/**
	 * Example 2: Using the Keycloak adapter with the Outbox singleton
	 */
	async useWithKeycloakAdapter() {
		// Get the singleton Outbox instance
		const outbox = await getOutbox();

		// Create a Keycloak adapter factory with the singleton Outbox
		const factory = new KeycloakAdapterFactory(outbox);

		// Get specialized adapters
		const noteAdapter = factory.createNoteAdapter();
		const churchAdapter = factory.createChurchAdapter();

		// Create a note with Keycloak permissions
		const note: Note = {
			id: 'note_abc',
			title: 'Sunday Service Notes',
			content: 'Today\'s sermon was about...',
			date: new Date(),
			scriptureReferences: [],
			createdAt: new Date(),
			updatedAt: new Date()
		};

		await noteAdapter.create(note, 'user_123', {
			sharedReadWith: ['user_456', 'user_789'],
			metadata: {
				source: 'api',
				version: '1.0.0'
			}
		});

		// Share the note with additional users
		await noteAdapter.grantPermission(
			'note_abc',
			'user_999',
			['read', 'comment'],
			{ sharedBy: 'user_123' }
		);

		// Transfer ownership
		await noteAdapter.transferOwnership(
			'note_abc',
			'user_123',
			'user_456',
			{ reason: 'user-requested' }
		);

		// Delete the note
		await noteAdapter.delete('note_abc', {
			deletedBy: 'user_456',
			reason: 'cleanup'
		});
	}

	/**
	 * Example 3: Processing outbox events manually
	 */
	async processEvents() {
		const outbox = await getOutbox();

		// Process up to 50 due events
		await outbox.processDue(50);

		// This is typically done by a worker, but can be called manually
		// The OutboxSingleton also provides a convenience method
		await OutboxSingleton.processDueEvents(100);
	}

	/**
	 * Example 4: Using in a service class
	 */
	async useInService() {
		// This pattern ensures the Outbox is initialized and ready
		const createNoteWithPermissions = async (
			note: Note,
			ownerId: string,
			sharedWith: string[] = []
		) => {
			// Save note to database first
			// ... database save logic ...

			// Then enqueue Keycloak synchronization
			const outbox = await getOutbox();
			const factory = new KeycloakAdapterFactory(outbox);
			const noteAdapter = factory.createNoteAdapter();

			await noteAdapter.create(note, ownerId, {
				sharedReadWith: sharedWith,
				metadata: {
					createdAt: new Date().toISOString()
				}
			});
		};

		// Use the service
		await createNoteWithPermissions(
			{
				id: 'note_xyz',
				title: 'Bible Study Notes',
				content: 'Key points from today\'s study...',
				date: new Date(),
				scriptureReferences: [
					{
						book: 'John',
						chapter: 3,
						verse: 16
					}
				],
				createdAt: new Date(),
				updatedAt: new Date()
			},
			'user_leader',
			['user_member1', 'user_member2']
		);
	}
}

/**
 * Example 5: Using in Express route handlers
 */
export function setupRoutesWithOutbox(app: any) {
	app.post('/api/notes', async (req: any, res: any) => {
		try {
			const { note, sharedWith } = req.body;
			const userId = req.user.id;

			// Save note to database
			// const savedNote = await noteService.create(note);

			// Enqueue Keycloak synchronization
			const outbox = await getOutbox();
			const factory = new KeycloakAdapterFactory(outbox);
			const noteAdapter = factory.createNoteAdapter();

			await noteAdapter.create(note, userId, {
				sharedReadWith: sharedWith || []
			});

			res.json({ success: true, note });
		} catch (error) {
			console.error('Error creating note:', error);
			res.status(500).json({ error: 'Internal server error' });
		}
	});

	app.put('/api/notes/:id/share', async (req: any, res: any) => {
		try {
			const { id } = req.params;
			const { userIds, scopes } = req.body;

			const outbox = await getOutbox();
			const factory = new KeycloakAdapterFactory(outbox);
			const noteAdapter = factory.createNoteAdapter();

			for (const userId of userIds) {
				await noteAdapter.grantPermission(
					id,
					userId,
					scopes || ['read'],
					{ sharedAt: new Date().toISOString() }
				);
			}

			res.json({ success: true });
		} catch (error) {
			console.error('Error sharing note:', error);
			res.status(500).json({ error: 'Internal server error' });
		}
	});
}