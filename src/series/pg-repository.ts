import type { RawDb } from "../utils/database";
import type { SeriesRepository } from './repository';
import type { CreateSeriesInput, Series, SeriesFilters, UpdateSeriesInput } from './schemas';

export class PostgresSeriesRepository implements SeriesRepository {
  constructor(
    private readonly db: RawDb
  ) {
  }

  async create(input: CreateSeriesInput, authorId: string): Promise<Series> {
    return this.db.begin(async (tx) => {
      const id = crypto.randomUUID();
      const now = new Date();

      const result = await tx`
          INSERT INTO series (id, title, description, image, author_id, church_id,
                             status, published_at, created_at, updated_at)
          VALUES (${id}, ${input.title}, ${input.description}, ${input.image || null},
                  ${authorId}, ${input.churchId},
                  'draft', null, ${now}, ${now})
          RETURNING *
      `;

      return this.mapRowToSeries(result[0]);
    });
  }

  async update(id: string, input: UpdateSeriesInput): Promise<Series | null> {
    if (Object.keys(input).length === 0) {
      return this.findById(id);
    }

    const updateFields: any = {};
    if (input.title !== undefined) {
      updateFields.title = input.title;
    }
    if (input.description !== undefined) {
      updateFields.description = input.description;
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
    updateFields.updated_at = new Date();

    const setClause = Object.keys(updateFields)
      .map((key, index) => `${key} = $${index + 1}`)
      .join(', ');
    const values = Object.values(updateFields);
    values.push(id);

    const result = await this.db.unsafe(
      `UPDATE series
       SET ${setClause}
       WHERE id = $${values.length} RETURNING *`,
      values as any[]
    );

    if (result.length === 0) {
      return null;
    }

    return this.mapRowToSeries(result[0]);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db`
      DELETE FROM series
      WHERE id = ${id}
      RETURNING id
    `;

    return result.length > 0;
  }

  async findById(id: string): Promise<Series | null> {
    const result = await this.db`
      SELECT * FROM series
      WHERE id = ${id}
    `;

    if (result.length === 0) {
      return null;
    }

    return this.mapRowToSeries(result[0]);
  }

  async findAll(filters?: SeriesFilters): Promise<Series[]> {
    let result;

    if (!filters || Object.keys(filters).length === 0) {
      result = await this.db`
          SELECT *
          FROM series
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
        conditions.push(`church_id = ANY($${values.length + 1}::uuid[])`);
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

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const query = `SELECT *
                     FROM series ${whereClause}
                     ORDER BY published_at DESC NULLS LAST, created_at DESC`;

      result = await this.db.unsafe(query, values);
    }

    return result.map(row => this.mapRowToSeries(row));
  }

  async findByChurchId(churchId: string): Promise<Series[]> {
    const result = await this.db`
        SELECT *
        FROM series
        WHERE church_id = ${churchId}
        ORDER BY published_at DESC NULLS LAST, created_at DESC
    `;

    return result.map(row => this.mapRowToSeries(row));
  }

  async findByAuthorId(authorId: string): Promise<Series[]> {
    const result = await this.db`
        SELECT *
        FROM series
        WHERE author_id = ${authorId}
        ORDER BY published_at DESC NULLS LAST, created_at DESC
    `;

    return result.map(row => this.mapRowToSeries(row));
  }

  private mapRowToSeries(row: any): Series {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      image: row.image,
      authorId: row.author_id,
      churchId: row.church_id,
      status: row.status,
      publishedAt: row.published_at instanceof Date
        ? row.published_at
        : (row.published_at ? new Date(row.published_at) : null),
      createdAt: row.created_at instanceof Date ? row.created_at : new Date(row.created_at),
      updatedAt: row.updated_at instanceof Date ? row.updated_at : new Date(row.updated_at)
    };
  }
}