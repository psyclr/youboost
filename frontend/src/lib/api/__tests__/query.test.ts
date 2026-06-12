import { buildQuery } from '../query';

describe('buildQuery', () => {
  it('should return an empty string when params is undefined', () => {
    expect(buildQuery()).toBe('');
  });

  it('should return an empty string when params is empty', () => {
    expect(buildQuery({})).toBe('');
  });

  it('should return an empty string when all values are filtered out', () => {
    expect(buildQuery({ page: undefined, status: '' })).toBe('');
  });

  it('should serialize strings, numbers and booleans', () => {
    expect(buildQuery({ page: 2, status: 'PENDING', isActive: true })).toBe(
      '?page=2&status=PENDING&isActive=true',
    );
  });

  it('should keep false booleans', () => {
    expect(buildQuery({ isActive: false })).toBe('?isActive=false');
  });

  it('should keep zero numbers (callers map falsy skips to undefined)', () => {
    expect(buildQuery({ page: 0 })).toBe('?page=0');
  });

  it('should skip undefined and empty-string values but keep the rest', () => {
    expect(buildQuery({ page: 1, limit: undefined, status: '', userId: 'u1' })).toBe(
      '?page=1&userId=u1',
    );
  });

  it('should URL-encode values', () => {
    expect(buildQuery({ q: 'a b&c' })).toBe('?q=a+b%26c');
  });
});
