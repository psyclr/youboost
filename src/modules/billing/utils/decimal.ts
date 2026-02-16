export function toNumber(value: { toNumber?: () => number } | number | string): number {
  return Number(value);
}
