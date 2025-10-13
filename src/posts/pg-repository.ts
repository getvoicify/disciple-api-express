import type { RawDb } from "../utils/database";
import type { PostRepository } from './repository';
import type { CreatePostInput, Post, PostFilters, UpdatePostInput } from './schemas';
import { type GeneralizedKeycloakOutboxAdapter } from "../keycloak/generalized-outbox.adapter";

export class PostgresPostRepository implements PostRepository {
	private static ResourceType = 'posts' as const;
	constructor(
		private readonly db: RawDb,
		private readonly keycloakAdapter: GeneralizedKeycloakOutboxAdapter,
	) {
	}

	async create(input: CreatePostInput, authorId: string): Promise<Post> {
		return this.db.begin(async (tx) => {
			const id = crypto.randomUUID();
			const now = new Date();

			const result = await tx`
          INSERT INTO posts (id, title, content, author_id, church_id,
                             status, published_at, image,
                             tags, categories, scripture_references,
                             series_id, series_name,
                             created_at, updated_at)
          VALUES (${id}, ${input.title}, ${input.content}, ${authorId}, ${input.churchId},
                  'draft', null, ${input.image || null},
                  ${JSON.stringify(input.tags || [])},
                  ${JSON.stringify(input.categories || [])},
                  ${JSON.stringify(input.scriptureReferences || [])},
                  ${input.seriesId || null}, ${input.seriesName || null},
                  ${now}, ${now})
          RETURNING *
			`;
			const post = this.mapRowToPost(result[0]);
			await this.keycloakAdapter.enqueueResourceCreate(post, PostgresPostRepository.ResourceType, authorId);
			return post;
		});
	}

	async update(id: string, input: UpdatePostInput): Promise<Post | null> {
		return this.db.begin(async (tx) => {
			if (Object.keys(input).length === 0) {
				return this.findById(id);
			}

			const updateFields: any = {};
			if (input.title !== undefined) {
				updateFields.title = input.title;
			}
			if (input.content !== undefined) {
				updateFields.content = input.content;
			}
			if (input.status !== undefined) {
				updateFields.status = input.status;
				// Set published_at when status changes to published
				if (input.status === 'published') {
					updateFields.published_at = new Date();
				}
			}
			if (input.image !== undefined) {
				updateFields.image = input.image;
			}
			if (input.tags !== undefined) {
				updateFields.tags = JSON.stringify(input.tags);
			}
			if (input.categories !== undefined) {
				updateFields.categories = JSON.stringify(input.categories);
			}
			if (input.scriptureReferences !== undefined) {
				updateFields.scripture_references = JSON.stringify(input.scriptureReferences);
			}
			if (input.seriesId !== undefined) {
				updateFields.series_id = input.seriesId;
			}
			if (input.seriesName !== undefined) {
				updateFields.series_name = input.seriesName;
			}
			updateFields.updated_at = new Date();

			const setClause = Object.keys(updateFields)
				.map((key, index) => `${key} = $${index + 1}`)
				.join(', ');
			const values = Object.values(updateFields);
			values.push(id);

			const result = await tx.unsafe(
				`UPDATE posts
         SET ${setClause}
         WHERE id = $${values.length} RETURNING *`,
				values as any[]
			);

			if (result.length === 0) {
				return null;
			}

			return this.mapRowToPost(result[0]);
		});
	}

	async delete(id: string): Promise<boolean> {
		return this.db.begin(async (tx) => {
			const result = await tx`DELETE
                              FROM posts
                              WHERE id = ${id}
                              RETURNING id`;

			if (result.length === 0) {
				return false;
			}

			// Queue Keycloak resource deletion event
			await this.keycloakAdapter.enqueueResourceDelete(id, PostgresPostRepository.ResourceType);

			return true;
		});
	}

	async findById(id: string): Promise<Post | null> {
		const result = await this.db`SELECT *
                                 FROM posts
                                 WHERE id = ${id}`;

		if (result.length === 0) {
			return null;
		}

		return this.mapRowToPost(result[0]);
	}

	async findAll(filters?: PostFilters): Promise<Post[]> {
		let result;

		if (!filters || Object.keys(filters).length === 0) {
			result = await this.db`
          SELECT *
          FROM posts
          ORDER BY published_at DESC NULLS LAST, created_at DESC
			`;
		} else {
			// Build dynamic query based on filters
			const conditions = [];
			const values: any[] = [];

			// Authorization filter - always apply if provided
			if (filters.authorizedIds) {
				if (filters.authorizedIds.length === 0) {
					// User has no authorized resources, return empty result
					return [];
				}
				// Convert JavaScript array to PostgreSQL array format for unsafe query
				const pgArray = `{${filters.authorizedIds.join(',')}}`;
				conditions.push(`id = ANY($${values.length + 1}::uuid[])`);
				values.push(pgArray);
			}

			if (filters.churchId) {
				conditions.push(`church_id = $${values.length + 1}`);
				values.push(filters.churchId);
			}

			if (filters.authorId) {
				conditions.push(`author_id = $${values.length + 1}`);
				values.push(filters.authorId);
			}

			if (filters.status) {
				conditions.push(`status = $${values.length + 1}`);
				values.push(filters.status);
			}

			if (filters.seriesId) {
				conditions.push(`series_id = $${values.length + 1}`);
				values.push(filters.seriesId);
			}

			if (filters.tags && filters.tags.length > 0) {
				conditions.push(`tags::jsonb ?| $${values.length + 1}`);
				values.push(filters.tags);
			}

			if (filters.categories && filters.categories.length > 0) {
				conditions.push(`categories::jsonb ?| $${values.length + 1}`);
				values.push(filters.categories);
			}

			if (filters.startDate) {
				conditions.push(`created_at >= $${values.length + 1}`);
				values.push(filters.startDate);
			}

			if (filters.endDate) {
				conditions.push(`created_at <= $${values.length + 1}`);
				values.push(filters.endDate);
			}

			if (filters.scripture) {
				// Only add scripture filter if at least one field is provided
				const hasScriptureFilter = filters.scripture.book ||
					filters.scripture.chapter !== undefined ||
					filters.scripture.verse !== undefined;

				if (hasScriptureFilter) {
					const scriptureFilter: any = {};
					if (filters.scripture.book) {
						scriptureFilter.book = filters.scripture.book;
					}
					if (filters.scripture.chapter !== undefined && filters.scripture.chapter !== null) {
						scriptureFilter.chapter = filters.scripture.chapter;
					}
					if (filters.scripture.verse !== undefined && filters.scripture.verse !== null) {
						scriptureFilter.verse = filters.scripture.verse;
					}

					// Only add the condition if the filter has at least one property
					if (Object.keys(scriptureFilter).length > 0) {
						conditions.push(`scripture_references::jsonb @> $${values.length + 1}::jsonb`);
						values.push(JSON.stringify([scriptureFilter]));
					}
				}
			}

			const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
			const query = `SELECT *
                     FROM posts ${whereClause}
                     ORDER BY published_at DESC NULLS LAST, created_at DESC`;


			result = await this.db.unsafe(query, values);
		}

		return result.map(row => this.mapRowToPost(row));
	}

	async findByChurchId(churchId: string): Promise<Post[]> {
		const result = await this.db`
        SELECT *
        FROM posts
        WHERE church_id = ${churchId}
        ORDER BY published_at DESC NULLS LAST, created_at DESC
		`;

		return result.map(row => this.mapRowToPost(row));
	}

	async findByAuthorId(authorId: string): Promise<Post[]> {
		const result = await this.db`
        SELECT *
        FROM posts
        WHERE author_id = ${authorId}
        ORDER BY published_at DESC NULLS LAST, created_at DESC
		`;

		return result.map(row => this.mapRowToPost(row));
	}

	async getLatestPostInSeries(seriesId: string): Promise<Post | null> {
		const result = await this.db`
        SELECT *
        FROM posts
        WHERE series_id = ${seriesId}
          AND status = 'published'
          AND published_at IS NOT NULL
        ORDER BY published_at DESC
        LIMIT 1
		`;

		if (result.length === 0) {
			return null;
		}

		return this.mapRowToPost(result[0]);
	}

	private mapRowToPost(row: any): Post {
		return {
			id: row.id,
			title: row.title,
			content: row.content,
			authorId: row.author_id,
			churchId: row.church_id,
			status: row.status,
			publishedAt: row.published_at instanceof Date
				? row.published_at
				: (row.published_at ? new Date(row.published_at) : null),
			image: row.image,
			tags: typeof row.tags === 'string'
				? JSON.parse(row.tags)
				: row.tags || [],
			categories: typeof row.categories === 'string'
				? JSON.parse(row.categories)
				: row.categories || [],
			scriptureReferences: typeof row.scripture_references === 'string'
				? JSON.parse(row.scripture_references)
				: row.scripture_references || [],
			seriesId: row.series_id,
			seriesName: row.series_name,
			createdAt: row.created_at instanceof Date ? row.created_at : new Date(row.created_at),
			updatedAt: row.updated_at instanceof Date ? row.updated_at : new Date(row.updated_at)
		};
	}
}