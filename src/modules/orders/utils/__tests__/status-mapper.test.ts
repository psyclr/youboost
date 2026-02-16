import { mapProviderStatus, isTerminalStatus } from '../status-mapper';

describe('Status Mapper', () => {
  describe('mapProviderStatus', () => {
    it.each([
      ['completed', 'COMPLETED'],
      ['Completed', 'COMPLETED'],
      ['partial', 'PARTIAL'],
      ['Partial', 'PARTIAL'],
      ['canceled', 'CANCELLED'],
      ['Canceled', 'CANCELLED'],
      ['cancelled', 'CANCELLED'],
      ['Cancelled', 'CANCELLED'],
      ['in progress', 'PROCESSING'],
      ['In progress', 'PROCESSING'],
      ['pending', 'PROCESSING'],
      ['Pending', 'PROCESSING'],
      ['processing', 'PROCESSING'],
      ['Processing', 'PROCESSING'],
      ['error', 'FAILED'],
      ['Error', 'FAILED'],
      ['fail', 'FAILED'],
      ['Fail', 'FAILED'],
    ])('should map "%s" to "%s"', (input, expected) => {
      expect(mapProviderStatus(input)).toBe(expected);
    });

    it('should default to PROCESSING for unknown status', () => {
      expect(mapProviderStatus('unknown-status')).toBe('PROCESSING');
    });

    it('should default to PROCESSING for empty string', () => {
      expect(mapProviderStatus('')).toBe('PROCESSING');
    });
  });

  describe('isTerminalStatus', () => {
    it.each(['COMPLETED', 'PARTIAL', 'FAILED', 'CANCELLED', 'REFUNDED'])(
      'should return true for terminal status %s',
      (status) => {
        expect(isTerminalStatus(status)).toBe(true);
      },
    );

    it.each(['PROCESSING', 'PENDING', 'unknown'])(
      'should return false for non-terminal status %s',
      (status) => {
        expect(isTerminalStatus(status)).toBe(false);
      },
    );
  });
});
