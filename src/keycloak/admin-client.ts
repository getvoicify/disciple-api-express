import type {
	KeycloakAdminClient,
	KeycloakResource
} from './resource-manager';
import {handleAsync} from "../utils/handle-async";

export interface KeycloakAdminConfig {
	keycloakUrl: string;
	realm: string;
	clientId: string;
	clientSecret: string;
}

interface KeycloakTokenResponse {
	access_token: string;
	expires_in: number;
	token_type: string;
}

interface KeycloakResourceRequest {
	name: string;
	type?: string;
	attributes?: Record<string, string[]>;
	scopes?: string[];
	owner?: { id: string };
}

interface KeycloakResourceResponse {
	id: string;
	name: string;
	type?: string;
	attributes?: Record<string, string[]>;
	scopes?: string[];
}

interface Permission {
	scopes: string[];
	rsid: string;
	rsname: string;
}

export class KeycloakAdminClientImpl implements KeycloakAdminClient {
	private accessToken: string | null = null;
	private tokenExpiry = 0;

	constructor(private readonly config: KeycloakAdminConfig) {}

	async createResource(resource: KeycloakResource): Promise<KeycloakResource> {
		await this.ensureValidToken();

		// Extract owner from attributes if present
		const ownerId = resource.attributes?.owner_id?.[0];

		const resourceRequest: KeycloakResourceRequest = {
			name: resource.name,
			type: resource.type,
			attributes: resource.attributes,
			scopes: resource.scopes,
			// Set owner if provided in attributes
			...(ownerId && { owner: { id: ownerId } })
		};

		const url = `${this.config.keycloakUrl}/admin/realms/${this.config.realm}/clients/${await this.getClientUuid()}/authz/resource-server/resource`;

		const response = await fetch(url, {
			method: 'POST',
			headers: {
				'Authorization': `Bearer ${this.accessToken}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(resourceRequest)
		});

		if (!response.ok) {
			if (response.status === 409) {
				const error = new Error('Resource already exists');
				error.name = 'ResourceConflictError';
				throw error;
			}
			throw new Error(`Failed to create resource: ${response.statusText}`);
		}

		const created = await response.json() as KeycloakResourceResponse;
		return {
			id: created.id || resource.id,
			name: created.name,
			type: created.type,
			attributes: created.attributes || {},
			scopes: created.scopes || []
		};
	}

	async updateResource(resourceId: string, resource: KeycloakResource): Promise<KeycloakResource> {
		await this.ensureValidToken();

		const resourceRequest: KeycloakResourceRequest = {
			name: resource.name,
			type: resource.type,
			attributes: resource.attributes,
			scopes: resource.scopes
		};

		const url = `${this.config.keycloakUrl}/admin/realms/${this.config.realm}/clients/${await this.getClientUuid()}/authz/resource-server/resource/${resourceId}`;

		const response = await fetch(url, {
			method: 'PUT',
			headers: {
				'Authorization': `Bearer ${this.accessToken}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(resourceRequest)
		});

		if (!response.ok) {
			throw new Error(`Failed to update resource: ${response.statusText}`);
		}

		const updated = await response.json() as KeycloakResourceResponse;
		return {
			id: updated.id || resourceId,
			name: updated.name,
			type: updated.type,
			attributes: updated.attributes || {},
			scopes: updated.scopes || []
		};
	}

	async deleteResource(resourceId: string): Promise<void> {
		await this.ensureValidToken();

		const url = `${this.config.keycloakUrl}/admin/realms/${this.config.realm}/clients/${await this.getClientUuid()}/authz/resource-server/resource/${resourceId}`;

		const response = await fetch(url, {
			method: 'DELETE',
			headers: {
				'Authorization': `Bearer ${this.accessToken}`
			}
		});

		if (!response.ok) {
			if (response.status === 404) {
				const error = new Error('Resource not found');
				error.name = 'ResourceNotFoundError';
				throw error;
			}
			throw new Error(`Failed to delete resource: ${response.statusText}`);
		}
	}

	async getResourcesByIds(resourceIds: string[]): Promise<KeycloakResource[]> {
		if (resourceIds.length === 0) {
			return [];
		}

		await this.ensureValidToken();
		const clientUuid = await this.getClientUuid();

		// Batch fetch resources in parallel for better performance
		const fetchPromises = resourceIds.map(async (resourceId) => {
			try {
				const url = `${this.config.keycloakUrl}/admin/realms/${this.config.realm}/clients/${clientUuid}/authz/resource-server/resource/${resourceId}`;

				const response = await fetch(url, {
					method: 'GET',
					headers: {
						'Authorization': `Bearer ${this.accessToken}`
					}
				});

				if (response.ok) {
					const resource = await response.json() as KeycloakResourceResponse;
					return {
						id: resource.id,
						name: resource.name,
						type: resource.type,
						attributes: resource.attributes || {},
						scopes: resource.scopes || []
					};
				}
				return null; // Resource not found or not accessible
			} catch (error) {
				// Skip resources that can't be found or accessed
				console.warn(`Failed to fetch resource ${resourceId}:`, error);
				return null;
			}
		});

		// Wait for all requests to complete and filter out null results
		const results = await Promise.allSettled(fetchPromises);
		const resources: KeycloakResource[] = [];

		for (const result of results) {
			if (result.status === 'fulfilled' && result.value !== null) {
				resources.push(result.value);
			}
		}

		return resources;
	}

	async getUserPermissions(userToken: string, resourceType: string, scope: string): Promise<string[]> {
		const tokenEndpoint = `${this.config.keycloakUrl}/realms/${this.config.realm}/protocol/openid-connect/token`;

		const params = new URLSearchParams({
			grant_type: 'urn:ietf:params:oauth:grant-type:uma-ticket',
			audience: 'authz',
			response_mode: 'permissions',
			permission: `#${scope}`
		});

		const response = await fetch(tokenEndpoint, {
			method: 'POST',
			headers: {
				'Authorization': `Bearer ${userToken}`,
				'Content-Type': 'application/x-www-form-urlencoded'
			},
			body: params.toString()
		});

		if (!response.ok) {
			if (response.status === 403) {
				// User has no permissions, return empty array
				return [];
			}
			throw new Error(`Failed to get user permissions: ${response.statusText}`);
		}

		const [, permissions] = await handleAsync<Permission[]>(response.json() as Promise<Permission[]>);

		return permissions
			.filter(p =>
				p.scopes.includes(scope) &&
				p.rsname &&
				p.rsname.includes(resourceType)
			)
			.map(p => p.rsid);
	}

	private async ensureValidToken(): Promise<void> {
		if (this.accessToken && Date.now() < this.tokenExpiry) {
			return;
		}

		await this.refreshToken();
	}

	private async refreshToken(): Promise<void> {
		const tokenEndpoint = `${this.config.keycloakUrl}/realms/${this.config.realm}/protocol/openid-connect/token`;

		const params = new URLSearchParams({
			grant_type: 'client_credentials',
			client_id: this.config.clientId,
			client_secret: this.config.clientSecret
		});

		const response = await fetch(tokenEndpoint, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded'
			},
			body: params.toString()
		});

		if (!response.ok) {
			throw new Error(`Failed to obtain admin token: ${response.statusText}`);
		}

		const [, tokenResponse] = await handleAsync<KeycloakTokenResponse>(response.json() as Promise<KeycloakTokenResponse>);
		this.accessToken = tokenResponse.access_token;
		this.tokenExpiry = Date.now() + (tokenResponse.expires_in * 1000) - 30000; // 30s buffer
	}

	private async getClientUuid(): Promise<string> {
		await this.ensureValidToken();

		const url = `${this.config.keycloakUrl}/admin/realms/${this.config.realm}/clients?clientId=${this.config.clientId}`;

		const response = await fetch(url, {
			method: 'GET',
			headers: {
				'Authorization': `Bearer ${this.accessToken}`
			}
		});

		if (!response.ok) {
			throw new Error(`Failed to get client UUID: ${response.statusText}`);
		}

		const clients = await response.json() as Array<{ id: string; clientId: string }>;
		if (!clients || clients.length === 0) {
			throw new Error(`Client ${this.config.clientId} not found`);
		}

		return clients[0].id;
	}
}
