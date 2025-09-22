import {createOutbox, Outbox} from '../outbox';
import {PostgresOutboxStore} from '../outbox/postgres-store';
import {KeycloakOutboxPublisher} from '../keycloak/outbox.publisher';
import {KeycloakOutboxEvent} from '../keycloak/generalized-outbox.adapter';
import {getRawDb} from '../utils/database';
import {KeycloakResourceManagerImpl} from '../keycloak/resource-manager';
import dotenv from 'dotenv';
import {KeycloakAdminClientImpl} from "../keycloak/admin-client.ts";

dotenv.config();

/**
 * Singleton pattern for Outbox instance
 * This ensures a single Outbox instance lives throughout the worker lifecycle
 */
export class OutboxSingleton {
	private static instance: Outbox<KeycloakOutboxEvent> | null = null;
	private static isInitialized = false;
	private static initializationPromise: Promise<void> | null = null;

	/**
	 * Private constructor to prevent direct instantiation
	 */
	private constructor() {}

	/**
	 * Initialize the Outbox singleton
	 * This should be called once at the start of the worker
	 */
	static async initialize(): Promise<void> {
		// If already initializing, wait for that to complete
		if (this.initializationPromise) {
			return this.initializationPromise;
		}

		// If already initialized, return immediately
		if (this.isInitialized && this.instance) {
			return;
		}

		// Start initialization
		this.initializationPromise = this.doInitialization();
		await this.initializationPromise;
	}

	/**
	 * Perform the actual initialization
	 */
	private static async doInitialization(): Promise<void> {
		try {
			console.log('Initializing Outbox singleton...');

			// Get database configuration from environment
			const {
				POSTGRES_DB: DB_NAME,
				POSTGRES_USER: DB_USER,
				DB_PASSWORD,
				DB_HOST,
				DB_PORT,
				IAM_ENDPOINT: KEYCLOAK_URL,
				IAM_REALM: KEYCLOAK_REALM,
				KEYCLOAK_CLIENT_ID,
				KEYCLOAK_CLIENT_SECRET,
			} = process.env;

			// Validate required environment variables
			if (!KEYCLOAK_URL || !KEYCLOAK_REALM || !KEYCLOAK_CLIENT_ID || !KEYCLOAK_CLIENT_SECRET) {
				throw new Error('Missing required Keycloak environment variables');
			}

			// Initialize database connection
			const db = getRawDb({ DB_NAME, DB_USER, DB_PASSWORD, DB_HOST, DB_PORT });

			// Create the Outbox store (PostgreSQL)
			const store = new PostgresOutboxStore<KeycloakOutboxEvent>(db);

			// Initialize Keycloak admin client
			const keycloakAdmin = new KeycloakAdminClientImpl({
				keycloakUrl: KEYCLOAK_URL,
				realm: KEYCLOAK_REALM,
				clientId: KEYCLOAK_CLIENT_ID,
				clientSecret: KEYCLOAK_CLIENT_SECRET,
			});

			// Create Keycloak resource manager
			const resourceManager = new KeycloakResourceManagerImpl(keycloakAdmin);

			// Create the Outbox publisher (Keycloak)
			const publisher = new KeycloakOutboxPublisher(resourceManager);

			// Create the Outbox instance with configuration
			this.instance = createOutbox<KeycloakOutboxEvent>({
				store,
				publisher,
				retry: {
					maxAttempts: 5,
					backoffStrategy: 'exponential',
					initialDelayMs: 1000,
					maxDelayMs: 60000, // Max 1 minute between retries
				},
				now: () => Date.now(),
				idFactory: () => `evt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
			});

			this.isInitialized = true;
			console.log('Outbox singleton initialized successfully');
		} catch (error) {
			console.error('Failed to initialize Outbox singleton:', error);
			this.initializationPromise = null;
			throw error;
		}
	}

	/**
	 * Get the singleton Outbox instance
	 * @throws Error if the Outbox hasn't been initialized
	 */
	static getInstance(): Outbox<KeycloakOutboxEvent> {
		if (!this.instance || !this.isInitialized) {
			throw new Error(
				'Outbox singleton not initialized. Call OutboxSingleton.initialize() first.'
			);
		}
		return this.instance;
	}

	/**
	 * Destroy the singleton instance (useful for testing or graceful shutdown)
	 */
	static async destroy(): Promise<void> {
		console.log('Destroying Outbox singleton...');
		this.instance = null;
		this.isInitialized = false;
		this.initializationPromise = null;
	}

	/**
	 * Process due events from the outbox
	 * This should be called periodically by a worker
	 */
	static async processDueEvents(limit: number = 50): Promise<void> {
		const outbox = this.getInstance();
		try {
			await outbox.processDue(limit);
		} catch (error) {
			console.error('Error processing due events:', error);
			throw error;
		}
	}
}

/**
 * Convenience function to get the Outbox instance
 * Ensures initialization before returning the instance
 */
export async function getOutbox(): Promise<Outbox<KeycloakOutboxEvent>> {
	await OutboxSingleton.initialize();
	return OutboxSingleton.getInstance();
}

/**
 * Process outbox events - convenience function for workers
 */
export async function processOutboxEvents(limit?: number): Promise<void> {
	await OutboxSingleton.processDueEvents(limit);
}
