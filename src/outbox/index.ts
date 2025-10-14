import type {
  CreateOutboxOptions,
  Operation,
  Outbox,
  OutboxEvent,
  OutboxPublisher,
  OutboxStore,
  RetryPolicy,
} from './types';
import {logger} from '../logging';

export type { CreateOutboxOptions, Outbox, OutboxPublisher, OutboxStore, OutboxEvent, RetryPolicy, Operation } from './types';
export { NotImplementedError } from './types';

function computeNextAttemptTime(nowMs: number, attemptBefore: number, retry: RetryPolicy): number {
  const initial = retry.initialDelayMs ?? 1000;
  const strategy = retry.backoffStrategy ?? 'exponential';
  let delay: number;
  if (strategy === 'exponential') {
    // Use previous attempt count as exponent base per test expectation
    const factor = Math.pow(2, attemptBefore);
    delay = initial * factor;
  } else {
    // fixed
    delay = initial;
  }
  if (retry.maxDelayMs !== null && retry.maxDelayMs !== undefined) {
    delay = Math.min(delay, retry.maxDelayMs);
  }
  return nowMs + delay;
}

export function createOutbox<TPayload = unknown>(
  options: CreateOutboxOptions<TPayload>
): Outbox<TPayload> {
  const store: OutboxStore<TPayload> = options.store;
  const publisher: OutboxPublisher<TPayload> = options.publisher;
  const nowFn = options.now ?? (() => Date.now());
  const idFactory = options.idFactory ?? (() => `evt_${Math.random().toString(36).slice(2, 10)}`);
  const retry: RetryPolicy = {
    maxAttempts: options.retry?.maxAttempts ?? 5,
    backoffStrategy: options.retry?.backoffStrategy ?? 'exponential',
    initialDelayMs: options.retry?.initialDelayMs ?? 1000,
    maxDelayMs: options.retry?.maxDelayMs,
  };

  async function enqueue(op: Operation, entityType: string, entityId: string, payload?: TPayload): Promise<void> {
    const prev = await store.findLatestByEntity(entityType, entityId);

    let finalOp: Operation = op;
    if (prev) {
      if (prev.operation === 'create' && op === 'delete') {
        // create followed by delete -> no-op
        return;
      }
      if (prev.operation === 'create' && op === 'update') {
        // keep create
        finalOp = 'create';
      } else if (op === 'delete') {
        // any previous non-create (e.g., update) followed by delete -> delete
        finalOp = 'delete';
      }
    }

    const now = nowFn();
    const event: OutboxEvent<TPayload> = {
      id: idFactory(),
      entityType,
      entityId,
      operation: finalOp,
      payload,
      status: 'pending',
      attempt: 0,
      createdAt: now,
      updatedAt: now,
    };

    await store.create(event);
  }

  async function processDue(limit?: number): Promise<void> {
    const lim = typeof limit === 'number' ? limit : 50;
    const due = await store.fetchDue(lim);
    const now = nowFn();

		logger.debug({ count: due.length }, 'Processing outbox events');

    for (const evt of due) {
      try {
        await publisher.publish(evt);
        const updated: OutboxEvent<TPayload> = {
          ...evt,
          status: 'succeeded',
          attempt: evt.attempt + 1,
          updatedAt: now,
        };
        delete (updated as any).nextAttemptAt;
        await store.update(updated);
      } catch {
        const attemptBefore = evt.attempt;
        const attemptAfter = attemptBefore + 1;
        if (attemptAfter >= retry.maxAttempts) {
          const dead: OutboxEvent<TPayload> = {
            ...evt,
            status: 'dead_letter',
            attempt: attemptAfter,
            updatedAt: now,
          };
          delete (dead as any).nextAttemptAt;
          if (store.moveToDeadLetter) {
            await store.moveToDeadLetter(dead);
          } else {
            await store.update(dead);
          }
        } else {
          const nextAt = computeNextAttemptTime(now, attemptBefore, retry);
          const failed: OutboxEvent<TPayload> = {
            ...evt,
            status: 'failed',
            attempt: attemptAfter,
            nextAttemptAt: nextAt,
            updatedAt: now,
          };
          await store.update(failed);
        }
      }
    }
  }

  return {
    enqueueCreate: (t, id, payload) => enqueue('create', t, id, payload),
    enqueueUpdate: (t, id, payload) => enqueue('update', t, id, payload),
    enqueueDelete: (t, id, payload) => enqueue('delete', t, id, payload),
    processDue,
  };
}
