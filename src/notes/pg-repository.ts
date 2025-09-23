import type {RawDb} from "../utils/database";
import type {NoteRepository} from './repository';
import type {CreateNoteInput, Note, NoteFilters, UpdateNoteInput} from './schemas';

export class PostgresNoteRepository implements NoteRepository {
    constructor(
        private readonly db: RawDb,
    ) {
    }

    async create(input: CreateNoteInput, ownerId: string): Promise<Note> {
        return this.db.begin(async (tx) => {
            const id = crypto.randomUUID();
            const now = new Date();

            const result = await tx`
                INSERT INTO notes (id, title, content, date,
                                   scripture_references, images,
                                   created_at, updated_at)
                VALUES (${id}, ${input.title}, ${input.content}, ${now},
                        ${JSON.stringify(input.scriptureReferences || [])},
                        ${JSON.stringify(input.images || [])},
                        ${now}, ${now})
                RETURNING *
            `;

            return this.mapRowToNote(result[0]);
        });
    }

    async update(id: string, input: UpdateNoteInput): Promise<Note | null> {
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
            if (input.scriptureReferences !== undefined) {
                updateFields.scripture_references = JSON.stringify(input.scriptureReferences);
            }
            if (input.images !== undefined) {
                updateFields.images = JSON.stringify(input.images);
            }
            updateFields.updated_at = new Date();

            const setClause = Object.keys(updateFields)
                .map(key => `${key} = $${Object.keys(updateFields).indexOf(key) + 1}`)
                .join(', ');
            const values = Object.values(updateFields);
            values.push(id);

            const result = await tx.unsafe(
                `UPDATE notes
                 SET ${setClause}
                 WHERE id = $${values.length} RETURNING *`,
                values as any[]
            );

            if (result.length === 0) {
                return null;
            }

            return this.mapRowToNote(result[0]);
        });
    }

    async delete(id: string): Promise<boolean> {
        return this.db.begin(async (tx) => {
            const result = await tx`DELETE
                                    FROM notes
                                    WHERE id = ${id}
                                    RETURNING id`;

            return result.length !== 0;
        });
    }

    async findById(id: string): Promise<Note | null> {
        const result = await this.db`SELECT *
                                     FROM notes
                                     WHERE id = ${id}`;

        if (result.length === 0) {
            return null;
        }

        return this.mapRowToNote(result[0]);
    }

    async findAll(filters?: NoteFilters): Promise<Note[]> {
        let result;

        if (!filters || Object.keys(filters).length === 0) {
            result = await this.db`
                SELECT *
                FROM notes
                ORDER BY date DESC, created_at DESC
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
		        // Filter to only authorized resource IDs using postgres.js array handling
		        // Use IN clause instead of ANY() to avoid array serialization issues
		        const placeholders = filters.authorizedIds.map((_, i) => `$${values.length + i + 1}`).join(', ');
		        conditions.push(`id IN (${placeholders})`);
		        values.push(...filters.authorizedIds);
	        }

            if (filters.title) {
                conditions.push(`title ILIKE $${values.length + 1}`);
                values.push(`%${filters.title}%`);
            }

            if (filters.content) {
                conditions.push(`to_tsvector('english', content) @@ plainto_tsquery('english', $${values.length + 1})`);
                values.push(filters.content);
            }

            if (filters.startDate) {
                conditions.push(`date >= $${values.length + 1}`);
                values.push(filters.startDate);
            }

            if (filters.endDate) {
                conditions.push(`date <= $${values.length + 1}`);
                values.push(filters.endDate);
            }

            if (filters.scripture) {
                conditions.push(`scripture_references::jsonb @> $${values.length + 1}::jsonb`);
                const scriptureFilter: any = {};
                if (filters.scripture.book) {
                    scriptureFilter.book = filters.scripture.book;
                }
                if (filters.scripture.chapter) {
                    scriptureFilter.chapter = filters.scripture.chapter;
                }
                if (filters.scripture.verse) {
                    scriptureFilter.verse = filters.scripture.verse;
                }
                values.push(JSON.stringify([scriptureFilter]));
            }

            const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
            const query = `SELECT *
                           FROM notes ${whereClause}
                           ORDER BY date DESC, created_at DESC`;

            result = await this.db.unsafe(query, values);
        }

        return result.map(row => this.mapRowToNote(row));
    }

    private mapRowToNote(row: any): Note {
        return {
            id: row.id,
            title: row.title,
            content: row.content,
            date: row.date instanceof Date ? row.date : new Date(row.date),
            scriptureReferences: typeof row.scripture_references === 'string'
                ? JSON.parse(row.scripture_references)
                : row.scripture_references || [],
            images: typeof row.images === 'string'
                ? JSON.parse(row.images)
                : row.images || [],
            createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt || row.created_at),
            updatedAt: row.updatedAt instanceof Date ? row.updatedAt : new Date(row.updatedAt || row.updated_at)
        };
    }
}
