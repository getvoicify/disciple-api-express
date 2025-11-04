import {type RawDb} from "../utils/database";
import {KeycloakAdminClientImpl, type KeycloakAdminConfig} from "./admin-client";
import {KeycloakResourceManagerImpl} from "./resource-manager";
import {PostgresOutboxStore} from "../outbox/postgres-store";
import {createOutbox} from "../outbox";
import {GeneralizedKeycloakOutboxAdapter, type KeycloakOutboxEvent} from "./generalized-outbox.adapter";
import * as crypto from "node:crypto";
import {KeycloakOutboxPublisher} from "./outbox.publisher";
import {createKeycloakOutboxQueue} from "../queues/keycloak-outbox/queue";
import type { Queue } from "bullmq";
import type { KeycloakOutboxJobData } from "../queues/keycloak-outbox/types";

/**
 * Configuration options for setting up the Keycloak adapter
 */
export interface SetupKeycloakAdapterOptions {
	db: RawDb;
	config: KeycloakAdminConfig;
	redisUrl?: string;
}

export function setupKeycloakAdapter(
	db: RawDb,
	config: KeycloakAdminConfig,
	redisUrl?: string
): {
	adapter: GeneralizedKeycloakOutboxAdapter;
	outbox: ReturnType<typeof createOutbox<KeycloakOutboxEvent>>;
	queue: Queue<KeycloakOutboxJobData>;
} {

	const adminClient = new KeycloakAdminClientImpl(config);
	const resourceManager = new KeycloakResourceManagerImpl(adminClient);
	const publisher = new KeycloakOutboxPublisher(resourceManager);
	const store = new PostgresOutboxStore<KeycloakOutboxEvent>(db);

	const outbox = createOutbox<KeycloakOutboxEvent>({
		store,
		publisher,
		idFactory: () => crypto.randomUUID(),
		retry: {
			maxAttempts: 5,
			backoffStrategy: 'exponential',
			initialDelayMs: 1000,
			maxDelayMs: 60000,
		}
	});

	// Create the Keycloak outbox queue
	const queue = createKeycloakOutboxQueue(
		redisUrl ? { connection: { url: redisUrl } } : undefined
	);

	return {
		adapter: new GeneralizedKeycloakOutboxAdapter(outbox, queue),
		outbox,
		queue
	};
}
