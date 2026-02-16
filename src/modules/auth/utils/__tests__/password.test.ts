import { hashPassword, comparePassword } from '../password';

jest.mock('../../../../shared/config', () => ({
  getConfig: jest.fn().mockReturnValue({
    security: { bcryptRounds: 4 },
  }),
}));

describe('Password Utils', () => {
  it('should hash a password', async () => {
    const hash = await hashPassword('MyPassword123');
    expect(hash).toBeDefined();
    expect(hash).not.toBe('MyPassword123');
    expect(hash.startsWith('$2')).toBe(true);
  });

  it('should return true for matching password', async () => {
    const hash = await hashPassword('TestPass1');
    const result = await comparePassword('TestPass1', hash);
    expect(result).toBe(true);
  });

  it('should return false for non-matching password', async () => {
    const hash = await hashPassword('TestPass1');
    const result = await comparePassword('WrongPass1', hash);
    expect(result).toBe(false);
  });
});
