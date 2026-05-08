import type { OutboxEvent, OutboxEventType, OutboxEventOfType } from './events';

/**
 * A handler subscribes to a specific event type and reacts when the
 * outbox worker dispatches that event. Handlers must be idempotent —
 * events can be retried on failure, so every side effect must be safe
 * to apply more than once (use the outbox event id as idempotency key).
 */
export interface OutboxHandler<T extends OutboxEventType = OutboxEventType> {
  readonly eventType: T;
  readonly name: string;
  handle(event: OutboxEventOfType<T>, eventId: string): Promise<void>;
}

export interface HandlerRegistry {
  /**
   * Dispatch an event to every handler subscribed to its type. Handlers
   * run sequentially — if one throws, the remaining handlers are NOT
   * skipped; instead, the whole dispatch fails, the event stays PENDING,
   * and the worker retries the entire batch of handlers on next attempt.
   * Handlers that already succeeded will see the event replay, hence
   * the idempotency requirement.
   */
  dispatch(event: OutboxEvent, eventId: string): Promise<void>;
  /** For debug/admin: which handlers are registered for a given event type. */
  handlersFor(eventType: OutboxEventType): readonly string[];
}

export function createHandlerRegistry(handlers: readonly OutboxHandler[]): HandlerRegistry {
  const byType = new Map<OutboxEventType, OutboxHandler[]>();
  for (const handler of handlers) {
    const list = byType.get(handler.eventType) ?? [];
    list.push(handler);
    byType.set(handler.eventType, list);
  }

  async function dispatch(event: OutboxEvent, eventId: string): Promise<void> {
    const subscribers = byType.get(event.type) ?? [];
    if (subscribers.length === 0) return;
    for (const handler of subscribers) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await handler.handle(event as any, eventId);
    }
  }

  function handlersFor(eventType: OutboxEventType): readonly string[] {
    return (byType.get(eventType) ?? []).map((h) => h.name);
  }

  return { dispatch, handlersFor };
}
