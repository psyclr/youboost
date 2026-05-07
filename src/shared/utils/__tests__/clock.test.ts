import { createSystemClock, createFixedClock } from '../clock';

describe('Clock', () => {
  describe('createSystemClock', () => {
    it('returns current time', () => {
      const clock = createSystemClock();
      const before = Date.now();
      const now = clock.now().getTime();
      const after = Date.now();
      expect(now).toBeGreaterThanOrEqual(before);
      expect(now).toBeLessThanOrEqual(after);
    });

    it('returns a new Date instance on each call', () => {
      const clock = createSystemClock();
      const a = clock.now();
      const b = clock.now();
      expect(a).not.toBe(b);
    });
  });

  describe('createFixedClock', () => {
    it('accepts a Date instance', () => {
      const fixed = new Date('2026-05-07T12:00:00Z');
      const clock = createFixedClock(fixed);
      expect(clock.now().toISOString()).toBe('2026-05-07T12:00:00.000Z');
    });

    it('accepts an ISO string', () => {
      const clock = createFixedClock('2026-05-07T12:00:00Z');
      expect(clock.now().toISOString()).toBe('2026-05-07T12:00:00.000Z');
    });

    it('returns the same instant on every call', () => {
      const clock = createFixedClock('2026-05-07T12:00:00Z');
      const a = clock.now();
      const b = clock.now();
      expect(a.getTime()).toBe(b.getTime());
    });

    it('returns fresh Date objects (not shared reference)', () => {
      const clock = createFixedClock('2026-05-07T12:00:00Z');
      const a = clock.now();
      a.setFullYear(2000);
      const b = clock.now();
      expect(b.toISOString()).toBe('2026-05-07T12:00:00.000Z');
    });
  });
});
