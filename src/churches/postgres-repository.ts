import type { RawDb } from '../utils/database';
import type { IChurchRepository, IChurchMemberRepository } from './repository';
import type {
  Church,
  CreateChurchInput,
  UpdateChurchInput,
  ChurchFilters,
  ChurchMember,
  CreateChurchMemberInput,
  UpdateChurchMemberInput,
  MemberRole,
  MemberStatus
} from './schemas';

export class PostgresChurchRepository implements IChurchRepository {
  constructor(
    private readonly db: RawDb,
  ) {}

  async create(input: CreateChurchInput, ownerId: string): Promise<Church> {
    return this.db.begin(async (tx) => {
      const id = crypto.randomUUID();
      const now = new Date();

      // Generate unique slug
      const slug = await this.generateUniqueSlug(input.name);

      const result = await tx`
        INSERT INTO churches (
          id, slug, name, description, logo_url, cover_image_url,
          byline, mission_statement, address, latitude, longitude,
          email, phone_number, website_url, social_links,
          approval_status, created_by, created_at, updated_at,
          version
        ) VALUES (
          ${id}, ${slug}, ${input.name}, ${input.description || null},
          ${input.logoUrl || null}, ${input.coverImageUrl || null},
          ${input.byline || null}, ${input.missionStatement || null},
          ${input.address ? JSON.stringify(input.address) : null}, ${input.latitude || null}, ${input.longitude || null},
          ${input.email || null}, ${input.phoneNumber || null},
          ${input.websiteUrl || null}, ${input.socialLinks ? JSON.stringify(input.socialLinks) : null},
          'Pending', ${ownerId}, ${now}, ${now}, 1
        )
        RETURNING *
      `;

      const church = this.mapRowToChurch(result[0]);

      // Create owner membership
      await tx`
        INSERT INTO church_members (
          church_id, user_id, role, status, joined_at, updated_at
        ) VALUES (
          ${id}, ${ownerId}, 'Owner', 'Active', ${now}, ${now}
        )
      `;

      return church;
    });
  }

  async update(id: string, input: UpdateChurchInput, version: number): Promise<Church | null> {
    return this.db.begin(async (tx) => {
      if (Object.keys(input).length === 0) {
        return this.findById(id);
      }

      const updateFields: any = {};
      if (input.name !== undefined) updateFields.name = input.name;
      if (input.description !== undefined) updateFields.description = input.description;
      if (input.logoUrl !== undefined) updateFields.logo_url = input.logoUrl;
      if (input.coverImageUrl !== undefined) updateFields.cover_image_url = input.coverImageUrl;
      if (input.byline !== undefined) updateFields.byline = input.byline;
      if (input.missionStatement !== undefined) updateFields.mission_statement = input.missionStatement;
      if (input.address !== undefined) updateFields.address = JSON.stringify(input.address);
      if (input.latitude !== undefined) updateFields.latitude = input.latitude;
      if (input.longitude !== undefined) updateFields.longitude = input.longitude;
      if (input.email !== undefined) updateFields.email = input.email;
      if (input.phoneNumber !== undefined) updateFields.phone_number = input.phoneNumber;
      if (input.websiteUrl !== undefined) updateFields.website_url = input.websiteUrl;
      if (input.socialLinks !== undefined) updateFields.social_links = JSON.stringify(input.socialLinks);

      updateFields.updated_at = new Date();
      updateFields.version = version + 1;

      const setClause = Object.keys(updateFields)
        .map((key, index) => `${key} = $${index + 1}`)
        .join(', ');
      const values: any[] = Object.values(updateFields);
      values.push(id, version);

      const result = await tx.unsafe(
        `UPDATE churches SET ${setClause} WHERE id = $${values.length - 1} AND version = $${values.length} RETURNING *`,
        values
      );

      if (result.length === 0) {
        return null; // Version conflict or not found
      }

      return this.mapRowToChurch(result[0]);
    });
  }

  async delete(id: string): Promise<boolean> {
    return this.db.begin(async (tx) => {
      const result = await tx`
        UPDATE churches
        SET deleted_at = NOW()
        WHERE id = ${id} AND deleted_at IS NULL
        RETURNING id
      `;

      if (result.length === 0) {
        return false;
      }

      return true;
    });
  }

  async findById(id: string): Promise<Church | null> {
    const result = await this.db`
      SELECT * FROM churches
      WHERE id = ${id} AND deleted_at IS NULL
    `;

    if (result.length === 0) {
      return null;
    }

    return this.mapRowToChurch(result[0]);
  }

  async findBySlug(slug: string): Promise<Church | null> {
    const result = await this.db`
      SELECT * FROM churches
      WHERE slug = ${slug} AND deleted_at IS NULL
    `;

    if (result.length === 0) {
      return null;
    }

    return this.mapRowToChurch(result[0]);
  }

  async findAll(filters?: ChurchFilters): Promise<{ churches: Church[]; total: number }> {
    const conditions = ['deleted_at IS NULL'];
    const values: any[] = [];

    // Build WHERE conditions based on filters
    if (filters?.approvalStatus) {
      conditions.push(`approval_status = $${values.length + 1}`);
      values.push(filters.approvalStatus);
    }

    if (filters?.visibility) {
      // Visibility is derived from approval status, so we filter by approval status
      if (filters.visibility === 'Public') {
        conditions.push(`approval_status = $${values.length + 1}`);
        values.push('Approved');
      } else if (filters.visibility === 'Hidden') {
        conditions.push(`approval_status != $${values.length + 1}`);
        values.push('Approved');
      }
    }

    if (filters?.name) {
      conditions.push(`name ILIKE $${values.length + 1}`);
      values.push(`%${filters.name}%`);
    }

    if (filters?.createdBy) {
      conditions.push(`created_by = $${values.length + 1}`);
      values.push(filters.createdBy);
    }

    const whereClause = conditions.join(' AND ');

    // Get total count
    const countResult = await this.db.unsafe(
      `SELECT COUNT(*) as total FROM churches WHERE ${whereClause}`,
      values
    );
    const total = parseInt(countResult[0].total);

    // Apply pagination
    const page = filters?.page || 1;
    const pageSize = filters?.pageSize || 20;
    const offset = (page - 1) * pageSize;

    // Get paginated results
    const sortBy = filters?.sortBy || 'created_at';
    const sortOrder = filters?.sortOrder || 'desc';

    const query = `
      SELECT * FROM churches
      WHERE ${whereClause}
      ORDER BY ${sortBy} ${sortOrder}
      LIMIT $${values.length + 1} OFFSET $${values.length + 2}
    `;

    const result = await this.db.unsafe(query, [...values, pageSize, offset]);

    const churches = result.map(row => this.mapRowToChurch(row));

    return { churches, total };
  }

  async approve(id: string, approverId: string): Promise<boolean> {
    return this.db.begin(async (tx) => {
      const now = new Date();
      const result = await tx`
        UPDATE churches
        SET approval_status = 'Approved',
            approved_by = ${approverId},
            approved_at = ${now},
            updated_at = ${now}
        WHERE id = ${id} AND approval_status = 'Pending'
        RETURNING id
      `;

      return result.length > 0;
    });
  }

  async reject(id: string, rejectorId: string, reason: string): Promise<boolean> {
    return this.db.begin(async (tx) => {
      const now = new Date();
      const result = await tx`
        UPDATE churches
        SET approval_status = 'Rejected',
            rejected_by = ${rejectorId},
            rejected_at = ${now},
            rejection_reason = ${reason},
            updated_at = ${now}
        WHERE id = ${id} AND approval_status = 'Pending'
        RETURNING id
      `;

      return result.length > 0;
    });
  }

  async checkSlugExists(slug: string): Promise<boolean> {
    const result = await this.db`
      SELECT 1 FROM churches
      WHERE slug = ${slug} AND deleted_at IS NULL
    `;

    return result.length > 0;
  }

  async generateUniqueSlug(name: string): Promise<string> {
    const baseSlug = this.slugify(name);
    let slug = baseSlug;
    let counter = 1;

    while (await this.checkSlugExists(slug)) {
      counter++;
      slug = `${baseSlug}-${counter}`;
    }

    return slug;
  }

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '') // Remove non-word characters
      .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
      .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
  }

  private mapRowToChurch(row: any): Church {
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      description: row.description,
      logoUrl: row.logo_url,
      coverImageUrl: row.cover_image_url,
      byline: row.byline,
      missionStatement: row.mission_statement,
      address: row.address && typeof row.address === 'string' ? JSON.parse(row.address) : row.address,
      latitude: row.latitude ? parseFloat(row.latitude) : null,
      longitude: row.longitude ? parseFloat(row.longitude) : null,
      email: row.email,
      phoneNumber: row.phone_number,
      websiteUrl: row.website_url,
      socialLinks: row.social_links && typeof row.social_links === 'string' ? JSON.parse(row.social_links) : row.social_links,
      approvalStatus: row.approval_status,
      approvedBy: row.approved_by,
      approvedAt: row.approved_at ? new Date(row.approved_at) : null,
      rejectedBy: row.rejected_by,
      rejectedAt: row.rejected_at ? new Date(row.rejected_at) : null,
      rejectionReason: row.rejection_reason,
      createdBy: row.created_by,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      version: row.version,
      visibility: row.approval_status === 'Approved' ? 'Public' : 'Hidden'
    };
  }
}

export class PostgresChurchMemberRepository implements IChurchMemberRepository {
  constructor(private db: RawDb) {}

  async create(input: CreateChurchMemberInput, invitedBy?: string): Promise<ChurchMember> {
    const id = crypto.randomUUID();
    const now = new Date();

    const result = await this.db`
      INSERT INTO church_members (
        id, church_id, user_id, role, status, joined_at, updated_at,
        invited_by, invited_at
      ) VALUES (
        ${id}, ${input.churchId}, ${input.userId}, ${input.role || 'Member'},
        ${invitedBy ? 'Invited' : 'Active'}, ${now}, ${now}, ${invitedBy || null}, ${invitedBy ? now : null}
      )
      RETURNING *
    `;

    return this.mapRowToChurchMember(result[0]);
  }

  async update(id: string, input: UpdateChurchMemberInput): Promise<ChurchMember | null> {
    const updateFields: any = {};
    if (input.role !== undefined) updateFields.role = input.role;
    if (input.status !== undefined) updateFields.status = input.status;
    updateFields.updated_at = new Date();

    if (Object.keys(updateFields).length === 1) { // Only updated_at
      return this.findById(id);
    }

    const setClause = Object.keys(updateFields)
      .map((key, index) => `${key} = $${index + 1}`)
      .join(', ');
    const values: any[] = Object.values(updateFields);
    values.push(id);

    const result = await this.db.unsafe(
      `UPDATE church_members SET ${setClause} WHERE id = $${values.length} RETURNING *`,
      values
    );

    if (result.length === 0) {
      return null;
    }

    return this.mapRowToChurchMember(result[0]);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db`DELETE FROM church_members WHERE id = ${id} RETURNING id`;
    return result.length > 0;
  }

  async findById(id: string): Promise<ChurchMember | null> {
    const result = await this.db`SELECT * FROM church_members WHERE id = ${id}`;

    if (result.length === 0) {
      return null;
    }

    return this.mapRowToChurchMember(result[0]);
  }

  async findByChurchAndUser(churchId: string, userId: string): Promise<ChurchMember | null> {
    const result = await this.db`
      SELECT * FROM church_members
      WHERE church_id = ${churchId} AND user_id = ${userId}
    `;

    if (result.length === 0) {
      return null;
    }

    return this.mapRowToChurchMember(result[0]);
  }

  async findByChurch(churchId: string, filters?: { role?: MemberRole; status?: MemberStatus }): Promise<ChurchMember[]> {
    const conditions = ['church_id = $1'];
    const values: any[] = [churchId];

    if (filters?.role) {
      conditions.push(`role = $${values.length + 1}`);
      values.push(filters.role);
    }

    if (filters?.status) {
      conditions.push(`status = $${values.length + 1}`);
      values.push(filters.status);
    }

    const whereClause = conditions.join(' AND ');
    const query = `SELECT * FROM church_members WHERE ${whereClause} ORDER BY joined_at DESC`;

    const result = await this.db.unsafe(query, values);

    return result.map(row => this.mapRowToChurchMember(row));
  }

  async findByUser(userId: string, filters?: { status?: MemberStatus }): Promise<ChurchMember[]> {
    const conditions = ['user_id = $1'];
    const values: any[] = [userId];

    if (filters?.status) {
      conditions.push(`status = $${values.length + 1}`);
      values.push(filters.status);
    }

    const whereClause = conditions.join(' AND ');
    const query = `SELECT * FROM church_members WHERE ${whereClause} ORDER BY joined_at DESC`;

    const result = await this.db.unsafe(query, values);

    return result.map(row => this.mapRowToChurchMember(row));
  }

  async updateRole(id: string, role: MemberRole): Promise<boolean> {
    const result = await this.db`
      UPDATE church_members
      SET role = ${role}, updated_at = NOW()
      WHERE id = ${id}
      RETURNING id
    `;

    return result.length > 0;
  }

  async updateStatus(id: string, status: MemberStatus): Promise<boolean> {
    const result = await this.db`
      UPDATE church_members
      SET status = ${status}, updated_at = NOW()
      WHERE id = ${id}
      RETURNING id
    `;

    return result.length > 0;
  }

  private mapRowToChurchMember(row: any): ChurchMember {
    return {
      id: row.id,
      churchId: row.church_id,
      userId: row.user_id,
      role: row.role,
      status: row.status,
      joinedAt: new Date(row.joined_at),
      updatedAt: new Date(row.updated_at),
      invitedBy: row.invited_by,
      invitedAt: row.invited_at ? new Date(row.invited_at) : null
    };
  }
}
