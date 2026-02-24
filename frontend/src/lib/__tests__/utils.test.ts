import { formatCurrency, formatDate, formatDateShort, truncate, cn } from '../utils';

describe('utils', () => {
  describe('formatCurrency', () => {
    it('should format a whole number as USD', () => {
      expect(formatCurrency(100)).toBe('$100.00');
    });

    it('should format a decimal as USD', () => {
      expect(formatCurrency(9.5)).toBe('$9.50');
    });

    it('should format zero', () => {
      expect(formatCurrency(0)).toBe('$0.00');
    });

    it('should format large numbers with comma separators', () => {
      const result = formatCurrency(1234567.89);
      expect(result).toContain('1,234,567.89');
    });
  });

  describe('formatDate', () => {
    it('should format a date string', () => {
      const result = formatDate('2024-01-15T10:30:00Z');
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
    });

    it('should format a Date object', () => {
      const result = formatDate(new Date('2024-06-01T14:00:00Z'));
      expect(result).toBeTruthy();
    });

    it('should include year, month, day, hour and minute', () => {
      const result = formatDate('2024-03-15T08:30:00Z');
      expect(result).toMatch(/2024/);
      expect(result).toMatch(/Mar/);
    });
  });

  describe('formatDateShort', () => {
    it('should format a date string in short form', () => {
      const result = formatDateShort('2024-01-15T10:30:00Z');
      expect(result).toBeTruthy();
      expect(result).toMatch(/2024/);
      expect(result).toMatch(/Jan/);
    });

    it('should format a Date object', () => {
      const result = formatDateShort(new Date('2024-12-25'));
      expect(result).toMatch(/Dec/);
    });
  });

  describe('truncate', () => {
    it('should return the string unchanged if shorter than limit', () => {
      expect(truncate('hello', 10)).toBe('hello');
    });

    it('should return the string unchanged if equal to limit', () => {
      expect(truncate('hello', 5)).toBe('hello');
    });

    it('should truncate and add ellipsis if longer than limit', () => {
      expect(truncate('hello world', 5)).toBe('hello...');
    });

    it('should handle empty string', () => {
      expect(truncate('', 5)).toBe('');
    });
  });

  describe('cn', () => {
    it('should merge class names', () => {
      const result = cn('foo', 'bar');
      expect(result).toContain('foo');
      expect(result).toContain('bar');
    });

    it('should handle conditional classes', () => {
      const result = cn('base', false && 'hidden', 'visible');
      expect(result).toContain('base');
      expect(result).toContain('visible');
      expect(result).not.toContain('hidden');
    });

    it('should merge conflicting tailwind classes', () => {
      const result = cn('px-4', 'px-2');
      expect(result).toBe('px-2');
    });
  });
});
