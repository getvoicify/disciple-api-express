// Outbox utility contracts (no implementation)

export type Operation = 'create' | 'update' | 'delete';

export type EventStatus =
  | 'pending'
  | 'processing'
  | 'succeeded'
  | 'failed'
  | 'dead_letter';

export interface RetryPolicy {
  maxAttempts: number; // e.g., 5
  backoffStrategy?: 'fixed' | 'exponential';
  initialDelayMs?: number; // default 1000
  maxDelayMs?: number; // optional cap for exponential
}

export interface OutboxEvent<TPayload = unknown> {
  id: string;
  entityType: string; // e.g., 'user'
  entityId: string; // e.g., '123'
  operation: Operation;
  payload?: TPayload; // optional payload for consumers
  status: EventStatus;
  attempt: number; // how many times attempted
  nextAttemptAt?: number; // epoch ms when eligible
  createdAt: number; // epoch ms
  updatedAt: number; // epoch ms
  // optional metadata bag
  metadata?: Record<string, unknown>;
}

export interface OutboxStore<TPayload = unknown> {
  // Persist a new event
  create(event: OutboxEvent<TPayload>): Promise<void>;

  // Update existing event
  update(event: OutboxEvent<TPayload>): Promise<void>;

  // Return events eligible for processing (e.g., pending and due)
  fetchDue(limit: number): Promise<OutboxEvent<TPayload>[]>;

  // Get latest event for a given entity to support coalescing
  findLatestByEntity(
    entityType: string,
    entityId: string
  ): Promise<OutboxEvent<TPayload> | undefined>;

  // Optional: dead-letter tracking
  moveToDeadLetter?(event: OutboxEvent<TPayload>): Promise<void>;
}

export interface OutboxPublisher<TPayload = unknown> {
  publish(event: OutboxEvent<TPayload>): Promise<void>;
}

export interface CreateOutboxOptions<TPayload = unknown> {
  store: OutboxStore<TPayload>;
  publisher: OutboxPublisher<TPayload>;
  retry?: RetryPolicy;
  // clock injection for testing
  now?: () => number;
  idFactory?: () => string;
}

export interface Outbox<TPayload = unknown> {
  enqueueCreate(entityType: string, entityId: string, payload?: TPayload): Promise<void>;
  enqueueUpdate(entityType: string, entityId: string, payload?: TPayload): Promise<void>;
  enqueueDelete(entityType: string, entityId: string, payload?: TPayload): Promise<void>;

  // Process due events once (pull + dispatch)
  processDue(limit?: number): Promise<void>;
}

export class NotImplementedError extends Error {
  constructor(message = 'Outbox: Not implemented') {
    super(message);
    this.name = 'NotImplementedError';
  }
}
