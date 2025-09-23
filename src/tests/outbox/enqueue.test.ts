import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createOutbox } from '../../outbox';
import type { OutboxStore, OutboxPublisher, OutboxEvent, Operation } from '../../outbox';

const fixedNow = 1_725_000_000_000; // arbitrary epoch ms
const nextId = (() => {
  let i = 0;
  return () => `evt_${++i}`;
})();

function makeStore() {
  const store: OutboxStore<Record<string, unknown>> = {
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

describe('Outbox enqueue basics', () => {
  let store: ReturnType<typeof makeStore>;
  let publisher: ReturnType<typeof makePublisher>;
  let outbox: ReturnType<typeof createOutbox<Record<string, unknown>>>;

  beforeEach(() => {
    store = makeStore();
    publisher = makePublisher();
    outbox = createOutbox({ store, publisher, now: () => fixedNow, idFactory: nextId, retry: { maxAttempts: 5, backoffStrategy: 'exponential', initialDelayMs: 1000 } });
  });

  const cases: { op: Operation; method: keyof typeof outbox }[] = [
    { op: 'create', method: 'enqueueCreate' },
    { op: 'update', method: 'enqueueUpdate' },
    { op: 'delete', method: 'enqueueDelete' },
  ];

  cases.forEach(({ op, method }) => {
    it(`enqueues a ${op} event with proper shape`, async () => {
      const payload = { foo: 'bar' };
      await (outbox[method] as any)('user', '123', payload);

      expect(store.create).toHaveBeenCalledTimes(1);
      const event = (store.create as any).mock.calls[0][0] as OutboxEvent;
      expect(event).toMatchObject({
        id: expect.stringMatching(/^evt_/),
        entityType: 'user',
        entityId: '123',
        operation: op,
        payload,
        status: 'pending',
        attempt: 0,
        createdAt: fixedNow,
        updatedAt: fixedNow,
      });
      expect(event.nextAttemptAt).toBeUndefined();
    });
  });
});

describe('Outbox enqueue coalescing', () => {
  it('create followed by update remains create', async () => {
    const store = makeStore();
    const publisher = makePublisher();
    // Simulate that the latest event is a prior create
    (store.findLatestByEntity as any).mockResolvedValueOnce({
      id: 'evt_existing',
      entityType: 'user',
      entityId: 'abc',
      operation: 'create',
      payload: { a: 1 },
      status: 'pending',
      attempt: 0,
      createdAt: fixedNow - 1000,
      updatedAt: fixedNow - 1000,
    } satisfies Partial<OutboxEvent>);

    const outbox = createOutbox({ store, publisher, now: () => fixedNow, idFactory: nextId, retry: { maxAttempts: 5 } });
    await outbox.enqueueUpdate('user', 'abc', { a: 2 });

    expect(store.create).toHaveBeenCalledTimes(1);
    const event = (store.create as any).mock.calls[0][0] as OutboxEvent;
    expect(event.operation).toBe('create');
  });

  it('update followed by delete collapses to delete', async () => {
    const store = makeStore();
    const publisher = makePublisher();
    (store.findLatestByEntity as any).mockResolvedValueOnce({
      id: 'evt_existing',
      entityType: 'user',
      entityId: 'abc',
      operation: 'update',
      status: 'pending',
      attempt: 0,
      createdAt: fixedNow - 1000,
      updatedAt: fixedNow - 1000,
    } satisfies Partial<OutboxEvent>);

    const outbox = createOutbox({ store, publisher, now: () => fixedNow, idFactory: nextId, retry: { maxAttempts: 5 } });
    await outbox.enqueueDelete('user', 'abc');

    expect(store.create).toHaveBeenCalledTimes(1);
    const event = (store.create as any).mock.calls[0][0] as OutboxEvent;
    expect(event.operation).toBe('delete');
  });

  it('create followed by delete becomes no-op (no event created)', async () => {
    const store = makeStore();
    const publisher = makePublisher();
    (store.findLatestByEntity as any).mockResolvedValueOnce({
      id: 'evt_existing',
      entityType: 'user',
      entityId: 'abc',
      operation: 'create',
      status: 'pending',
      attempt: 0,
      createdAt: fixedNow - 1000,
      updatedAt: fixedNow - 1000,
    } satisfies Partial<OutboxEvent>);

    const outbox = createOutbox({ store, publisher, now: () => fixedNow, idFactory: nextId, retry: { maxAttempts: 5 } });
    await outbox.enqueueDelete('user', 'abc');

    expect(store.create).not.toHaveBeenCalled();
  });
});
