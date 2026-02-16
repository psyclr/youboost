import { toNumber } from '../decimal';

describe('toNumber', () => {
  it('should convert a number to number', () => {
    expect(toNumber(42)).toBe(42);
  });

  it('should convert a string to number', () => {
    expect(toNumber('99.99')).toBe(99.99);
  });

  it('should convert a Decimal-like object to number', () => {
    const decimal = { toNumber: (): number => 123.45, toString: (): string => '123.45' };
    expect(toNumber(decimal)).toBe(123.45);
  });

  it('should handle zero', () => {
    expect(toNumber(0)).toBe(0);
  });

  it('should handle negative values', () => {
    expect(toNumber(-10.5)).toBe(-10.5);
  });
});
