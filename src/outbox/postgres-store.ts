import type { RawDb } from '../utils/database';
import type { OutboxStore, OutboxEvent } from './types';

/**
 * PostgreSQL implementation of OutboxStore
 * Stores outbox events in a dedicated database table
 */
export class PostgresOutboxStore<TPayload = unknown> implements OutboxStore<TPayload> {
  constructor(private readonly db: RawDb) {}

  async create(event: OutboxEvent<TPayload>): Promise<void> {
    await this.db`
      INSERT INTO outbox_events (
        id, entity_type, entity_id, operation, status, attempt, 
        payload, created_at, updated_at, next_attempt_at
      ) VALUES (
        ${event.id}, ${event.entityType}, ${event.entityId}, ${event.operation},
        ${event.status}, ${event.attempt}, ${JSON.stringify(event.payload)},
        ${new Date(event.createdAt)}, ${new Date(event.updatedAt)}, 
        ${event.nextAttemptAt ? new Date(event.nextAttemptAt) : null}
      )
    `;
  }

  async update(event: OutboxEvent<TPayload>): Promise<void> {
    await this.db`
      UPDATE outbox_events SET
        status = ${event.status},
        attempt = ${event.attempt},
        updated_at = ${new Date(event.updatedAt)},
        next_attempt_at = ${event.nextAttemptAt ? new Date(event.nextAttemptAt) : null}
      WHERE id = ${event.id}
    `;
  }

  async fetchDue(limit: number): Promise<OutboxEvent<TPayload>[]> {
    const now = new Date();
    const result = await this.db`
      SELECT * FROM outbox_events 
      WHERE status IN ('pending', 'failed') 
      AND (next_attempt_at IS NULL OR next_attempt_at <= ${now})
      ORDER BY created_at ASC
      LIMIT ${limit}
    `;

    return result.map(row => this.mapRowToEvent(row));
  }

  async findLatestByEntity(entityType: string, entityId: string): Promise<OutboxEvent<TPayload> | undefined> {
    const result = await this.db`
      SELECT * FROM outbox_events 
      WHERE entity_type = ${entityType} AND entity_id = ${entityId}
      AND status IN ('pending', 'failed', 'succeeded')
      ORDER BY created_at DESC
      LIMIT 1
    `;

    if (result.length === 0) {
      return undefined;
    }

    return this.mapRowToEvent(result[0]);
  }

  async moveToDeadLetter(event: OutboxEvent<TPayload>): Promise<void> {
    await this.db.begin(async (tx) => {
      // Move to dead letter table
      await tx`
        INSERT INTO outbox_dead_letter (
          id, entity_type, entity_id, operation, status, attempt,
          payload, created_at, updated_at, failed_at
        ) VALUES (
          ${event.id}, ${event.entityType}, ${event.entityId}, ${event.operation},
          ${event.status}, ${event.attempt}, ${JSON.stringify(event.payload)},
          ${new Date(event.createdAt)}, ${new Date(event.updatedAt)}, ${new Date()}
        )
      `;

      // Remove from main outbox table
      await tx`DELETE FROM outbox_events WHERE id = ${event.id}`;
    });
  }

  private mapRowToEvent(row: any): OutboxEvent<TPayload> {
    const event: OutboxEvent<TPayload> = {
      id: row.id,
      entityType: row.entity_type,
      entityId: row.entity_id,
      operation: row.operation,
      status: row.status,
      attempt: row.attempt,
      payload: row.payload ? JSON.parse(row.payload) : undefined,
      createdAt: row.created_at instanceof Date ? row.created_at.getTime() : new Date(row.created_at).getTime(),
      updatedAt: row.updated_at instanceof Date ? row.updated_at.getTime() : new Date(row.updated_at).getTime(),
    };

    if (row.next_attempt_at) {
      event.nextAttemptAt = row.next_attempt_at instanceof Date 
        ? row.next_attempt_at.getTime() 
        : new Date(row.next_attempt_at).getTime();
    }

    return event;
  }
}