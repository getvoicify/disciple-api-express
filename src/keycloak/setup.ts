import {RawDb} from "../utils/database";
import {KeycloakAdminClientImpl, KeycloakAdminConfig} from "./admin-client";
import {KeycloakResourceManagerImpl} from "./resource-manager";
import {PostgresOutboxStore} from "../outbox/postgres-store";
import {createOutbox} from "../outbox";
import {GeneralizedKeycloakOutboxAdapter, KeycloakOutboxEvent} from "./generalized-outbox.adapter";
import * as crypto from "node:crypto";
import {KeycloakOutboxPublisher} from "./outbox.publisher";

export function setupKeycloakAdapter(
	db: RawDb,
	config: KeycloakAdminConfig
) {

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

	return {adapter: new GeneralizedKeycloakOutboxAdapter(outbox), outbox};
}
