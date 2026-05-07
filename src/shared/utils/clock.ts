export interface Clock {
  now(): Date;
}

export function createSystemClock(): Clock {
  return {
    now: () => new Date(),
  };
}

export function createFixedClock(fixed: Date | string): Clock {
  const instant = fixed instanceof Date ? fixed : new Date(fixed);
  return {
    now: () => new Date(instant.getTime()),
  };
}
