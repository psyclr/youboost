import { StubEmailProvider, emailProvider } from '../stub-email-provider';

jest.mock('../../../../shared/utils/logger', () => ({
  createServiceLogger: jest.fn().mockReturnValue({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
}));

describe('StubEmailProvider', () => {
  it('should resolve send() without throwing', async () => {
    const provider = new StubEmailProvider();
    await expect(
      provider.send({ to: 'test@test.com', subject: 'Test', body: 'Body' }),
    ).resolves.toBeUndefined();
  });

  it('should export emailProvider as an instance of StubEmailProvider', () => {
    expect(emailProvider).toBeInstanceOf(StubEmailProvider);
  });
});
