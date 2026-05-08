import { createHandlerRegistry, type OutboxHandler } from '../handlers';
import type { OutboxEvent } from '../events';

function makeEvent(): OutboxEvent {
  return {
    type: 'order.created',
    aggregateType: 'order',
    aggregateId: 'ord-1',
    userId: 'user-1',
    payload: { orderId: 'ord-1', userId: 'user-1', status: 'PROCESSING', price: 10 },
  };
}

describe('HandlerRegistry', () => {
  it('dispatches to every handler subscribed to an event type', async () => {
    const calls: string[] = [];
    const handlers: OutboxHandler[] = [
      {
        eventType: 'order.created',
        name: 'webhook',
        handle: async () => {
          calls.push('webhook');
        },
      },
      {
        eventType: 'order.created',
        name: 'email',
        handle: async () => {
          calls.push('email');
        },
      },
      {
        eventType: 'order.cancelled',
        name: 'should-not-run',
        handle: async () => {
          calls.push('cancelled');
        },
      },
    ];
    const registry = createHandlerRegistry(handlers);

    await registry.dispatch(makeEvent(), 'event-1');

    expect(calls).toEqual(['webhook', 'email']);
  });

  it('no-op when no handlers match', async () => {
    const registry = createHandlerRegistry([]);
    await expect(registry.dispatch(makeEvent(), 'event-1')).resolves.toBeUndefined();
  });

  it('propagates handler errors to caller', async () => {
    const handler: OutboxHandler = {
      eventType: 'order.created',
      name: 'faulty',
      handle: async () => {
        throw new Error('boom');
      },
    };
    const registry = createHandlerRegistry([handler]);
    await expect(registry.dispatch(makeEvent(), 'event-1')).rejects.toThrow('boom');
  });

  it('stops at first failing handler in sequence', async () => {
    const calls: string[] = [];
    const handlers: OutboxHandler[] = [
      {
        eventType: 'order.created',
        name: 'first',
        handle: async () => {
          calls.push('first');
        },
      },
      {
        eventType: 'order.created',
        name: 'second',
        handle: async () => {
          calls.push('second');
          throw new Error('fail');
        },
      },
      {
        eventType: 'order.created',
        name: 'third',
        handle: async () => {
          calls.push('third');
        },
      },
    ];
    const registry = createHandlerRegistry(handlers);

    await expect(registry.dispatch(makeEvent(), 'event-1')).rejects.toThrow('fail');
    expect(calls).toEqual(['first', 'second']);
  });

  it('handlersFor returns registered handler names', () => {
    const handlers: OutboxHandler[] = [
      { eventType: 'order.created', name: 'a', handle: async () => undefined },
      { eventType: 'order.created', name: 'b', handle: async () => undefined },
      { eventType: 'deposit.confirmed', name: 'c', handle: async () => undefined },
    ];
    const registry = createHandlerRegistry(handlers);

    expect(registry.handlersFor('order.created')).toEqual(['a', 'b']);
    expect(registry.handlersFor('deposit.confirmed')).toEqual(['c']);
    expect(registry.handlersFor('order.failed')).toEqual([]);
  });
});
