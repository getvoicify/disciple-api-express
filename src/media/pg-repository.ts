import type {RawDb} from "../utils/database";
import type {MediaRepository} from './repository';
import type {CreateMediaInput, Media, MediaFilters, UpdateMediaInput} from './schemas';

export class PostgresMediaRepository implements MediaRepository {
	constructor(
		private readonly db: RawDb,
	) {
	}

	async create(input: CreateMediaInput, uploadedBy: string): Promise<Media> {
		const id = crypto.randomUUID();
		const now = new Date();

		const result = await this.db`
          INSERT INTO media (id, filename, original_filename, mime_type, file_size,
                             r2_url, r2_key, uploaded_by, created_at, updated_at)
          VALUES (${id}, ${input.filename}, ${input.originalFilename}, ${input.mimeType}, ${input.fileSize},
                  ${input.r2Url}, ${input.r2Key}, ${uploadedBy}, ${now}, ${now})
          RETURNING *
		`;
		return this.mapRowToMedia(result[0]);
	}

	async update(id: string, input: UpdateMediaInput): Promise<Media | null> {
		return this.db.begin(async (tx) => {
			if (Object.keys(input).length === 0) {
				return this.findById(id);
			}

			const updateFields: any = {};
			if (input.filename !== undefined) {
				updateFields.filename = input.filename;
			}
			if (input.originalFilename !== undefined) {
				updateFields.original_filename = input.originalFilename;
			}
			if (input.mimeType !== undefined) {
				updateFields.mime_type = input.mimeType;
			}
			if (input.fileSize !== undefined) {
				updateFields.file_size = input.fileSize;
			}
			if (input.r2Url !== undefined) {
				updateFields.r2_url = input.r2Url;
			}
			if (input.r2Key !== undefined) {
				updateFields.r2_key = input.r2Key;
			}
			updateFields.updated_at = new Date();

			const setClause = Object.keys(updateFields)
				.map(key => `${key} = $${Object.keys(updateFields).indexOf(key) + 1}`)
				.join(', ');
			const values = Object.values(updateFields);
			values.push(id);

			const result = await tx.unsafe(
				`UPDATE media
         SET ${setClause}
         WHERE id = $${values.length} RETURNING *`,
				values as any[]
			);

			if (result.length === 0) {
				return null;
			}

			return this.mapRowToMedia(result[0]);
		});
	}

	async delete(id: string): Promise<boolean> {
		const result = await this.db`DELETE
                                  FROM media
                                  WHERE id = ${id}
                                  RETURNING id`;

		return result.length > 0;
	}

	async findById(id: string): Promise<Media | null> {
		const result = await this.db`SELECT *
                                 FROM media
                                 WHERE id = ${id}`;

		if (result.length === 0) {
			return null;
		}

		return this.mapRowToMedia(result[0]);
	}

	async findAll(filters?: MediaFilters): Promise<Media[]> {
		let result;

		if (!filters || Object.keys(filters).length === 0) {
			result = await this.db`
          SELECT *
          FROM media
          ORDER BY created_at DESC
			`;
		} else {
			// Build dynamic query based on filters
			const conditions = [];
			const values: any[] = [];

			if (filters.uploadedBy) {
				conditions.push(`uploaded_by = $${values.length + 1}`);
				values.push(filters.uploadedBy);
			}

			if (filters.mimeType) {
				conditions.push(`mime_type = $${values.length + 1}`);
				values.push(filters.mimeType);
			}

			if (filters.filename) {
				conditions.push(`filename ILIKE $${values.length + 1}`);
				values.push(`%${filters.filename}%`);
			}

			if (filters.startDate) {
				conditions.push(`created_at >= $${values.length + 1}`);
				values.push(filters.startDate);
			}

			if (filters.endDate) {
				conditions.push(`created_at <= $${values.length + 1}`);
				values.push(filters.endDate);
			}

			if (filters.minFileSize) {
				conditions.push(`file_size >= $${values.length + 1}`);
				values.push(filters.minFileSize);
			}

			if (filters.maxFileSize) {
				conditions.push(`file_size <= $${values.length + 1}`);
				values.push(filters.maxFileSize);
			}

			const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
			const query = `SELECT *
                     FROM media ${whereClause}
                     ORDER BY created_at DESC`;

			result = await this.db.unsafe(query, values);
		}

		return result.map(row => this.mapRowToMedia(row));
	}

	async findByUploadedBy(uploadedBy: string): Promise<Media[]> {
		const result = await this.db`SELECT *
                                 FROM media
                                 WHERE uploaded_by = ${uploadedBy}
                                 ORDER BY created_at DESC`;

		return result.map(row => this.mapRowToMedia(row));
	}

	private mapRowToMedia(row: any): Media {
		return {
			id: row.id,
			filename: row.filename,
			originalFilename: row.original_filename,
			mimeType: row.mime_type,
			fileSize: row.file_size,
			r2Url: row.r2_url,
			r2Key: row.r2_key,
			uploadedBy: row.uploaded_by,
			createdAt: row.created_at instanceof Date ? row.created_at : new Date(row.created_at),
			updatedAt: row.updated_at instanceof Date ? row.updated_at : new Date(row.updated_at)
		};
	}
}
