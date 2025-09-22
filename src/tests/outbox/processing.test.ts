import { describe, it, expect, vi } from 'vitest';
import { createOutbox } from '../../outbox';
import type { OutboxStore, OutboxPublisher, OutboxEvent } from '../../outbox';

const fixedNow = 1_725_000_000_000;

function makeEvent(partial?: Partial<OutboxEvent>): OutboxEvent<any> {
  return {
    id: partial?.id ?? 'evt_1',
    entityType: partial?.entityType ?? 'user',
    entityId: partial?.entityId ?? 'u1',
    operation: partial?.operation ?? 'update',
    payload: partial?.payload ?? { p: 1 },
    status: partial?.status ?? 'pending',
    attempt: partial?.attempt ?? 0,
    nextAttemptAt: partial?.nextAttemptAt,
    createdAt: partial?.createdAt ?? fixedNow - 10_000,
    updatedAt: partial?.updatedAt ?? fixedNow - 10_000,
    metadata: partial?.metadata,
  };
}

function makeStore() {
  const store: OutboxStore = {
    create: vi.fn(async (_e: OutboxEvent) => {}),
    update: vi.fn(async (_e: OutboxEvent) => {}),
    fetchDue: vi.fn(async (_limit: number) => []),
    findLatestByEntity: vi.fn(async (_t: string, _id: string) => undefined),
    moveToDeadLetter: vi.fn(async (_e: OutboxEvent) => {}),
  };
  return store;
}

function makePublisher(): OutboxPublisher<Record<string, unknown>> {
  return { publish: vi.fn(async (_e: OutboxEvent) => {}) };
}

describe('Outbox processing', () => {
  it('processDue publishes due events and marks them succeeded', async () => {
    const store = makeStore();
    const publisher = makePublisher();
    const outbox = createOutbox({ store, publisher, now: () => fixedNow, retry: { maxAttempts: 5 } });

    const event = makeEvent({ id: 'evt_A' });
    (store.fetchDue as any).mockResolvedValueOnce([event]);

    await outbox.processDue();

    expect(store.fetchDue).toHaveBeenCalledWith(expect.any(Number));
    expect(publisher.publish).toHaveBeenCalledTimes(1);
    expect(publisher.publish).toHaveBeenCalledWith(event);

    expect(store.update).toHaveBeenCalledTimes(1);
    const updated = (store.update as any).mock.calls[0][0] as OutboxEvent;
    expect(updated.status).toBe('succeeded');
    expect(updated.attempt).toBe(1);
    expect(updated.updatedAt).toBe(fixedNow);
    expect(updated.nextAttemptAt).toBeUndefined();
  });

  it('on publisher error, increments attempt and schedules retry with fixed backoff', async () => {
    const store = makeStore();
    const publisher = makePublisher();
    (publisher.publish as any).mockRejectedValueOnce(new Error('boom'));

    const outbox = createOutbox({ store, publisher, now: () => fixedNow, retry: { maxAttempts: 3, backoffStrategy: 'fixed', initialDelayMs: 2000 } });

    const event = makeEvent({ id: 'evt_B', attempt: 0 });
    (store.fetchDue as any).mockResolvedValueOnce([event]);

    await outbox.processDue();

    expect(store.update).toHaveBeenCalledTimes(1);
    const updated = (store.update as any).mock.calls[0][0] as OutboxEvent;
    expect(updated.status).toBe('failed');
    expect(updated.attempt).toBe(1);
    expect(updated.nextAttemptAt).toBe(fixedNow + 2000);
  });

  it('exponential backoff caps at maxDelayMs when provided', async () => {
    const store = makeStore();
    const publisher = makePublisher();
    (publisher.publish as any).mockRejectedValueOnce(new Error('boom'));

    const outbox = createOutbox({ store, publisher, now: () => fixedNow, retry: { maxAttempts: 5, backoffStrategy: 'exponential', initialDelayMs: 500, maxDelayMs: 1500 } });

    const event = makeEvent({ id: 'evt_C', attempt: 3 }); // next delay would be 500 * 2^3 = 4000, capped to 1500
    (store.fetchDue as any).mockResolvedValueOnce([event]);

    await outbox.processDue();

    const updated = (store.update as any).mock.calls[0][0] as OutboxEvent;
    expect(updated.status).toBe('failed');
    expect(updated.attempt).toBe(4);
    expect(updated.nextAttemptAt).toBe(fixedNow + 1500);
  });

  it('after max attempts, moves to dead letter and does not schedule next attempt', async () => {
    const store = makeStore();
    const publisher = makePublisher();
    (publisher.publish as any).mockRejectedValueOnce(new Error('boom'));

    const outbox = createOutbox({ store, publisher, now: () => fixedNow, retry: { maxAttempts: 2, backoffStrategy: 'fixed', initialDelayMs: 1000 } });

    const event = makeEvent({ id: 'evt_D', attempt: 1 }); // next failure reaches 2 -> dead letter
    (store.fetchDue as any).mockResolvedValueOnce([event]);

    await outbox.processDue();

    expect(store.moveToDeadLetter).toHaveBeenCalledTimes(1);
    const dead = (store.moveToDeadLetter as any).mock.calls[0][0] as OutboxEvent;
    expect(dead.status).toBe('dead_letter');
    expect(dead.attempt).toBe(2);
    expect(dead.nextAttemptAt).toBeUndefined();
  });

  it('respects processDue limit parameter', async () => {
    const store = makeStore();
    const publisher = makePublisher();
    const outbox = createOutbox({ store, publisher, now: () => fixedNow, retry: { maxAttempts: 5 } });

    (store.fetchDue as any).mockResolvedValueOnce([]);
    await outbox.processDue(10);

    expect(store.fetchDue).toHaveBeenCalledWith(10);
  });

  it('publisher is pluggable (e.g., Keycloak) and receives full event', async () => {
    const store = makeStore();
    const keycloakPublisher: OutboxPublisher = { publish: vi.fn(async (_e: OutboxEvent) => {}) };
    const outbox = createOutbox({ store, publisher: keycloakPublisher, now: () => fixedNow, retry: { maxAttempts: 5 } });

    const event = makeEvent({ id: 'evt_E', entityType: 'group', entityId: 'g1', operation: 'create', payload: { name: 'Admins' } });
    (store.fetchDue as any).mockResolvedValueOnce([event]);

    await outbox.processDue();

    expect(keycloakPublisher.publish).toHaveBeenCalledWith(event);
  });
});
