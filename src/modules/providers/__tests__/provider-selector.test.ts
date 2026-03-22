import { selectProvider, selectProviderById } from '../provider-selector';

const mockGetConfig = jest.fn();

jest.mock('../../../shared/config', () => ({
  getConfig: (...args: unknown[]): unknown => mockGetConfig(...args),
}));

jest.mock('../../../shared/utils/logger', () => ({
  createServiceLogger: jest.fn().mockReturnValue({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
}));

const mockFindActiveProvidersByPriority = jest.fn();
const mockFindProviderById = jest.fn();

jest.mock('../providers.repository', () => ({
  findActiveProvidersByPriority: (...args: unknown[]): unknown =>
    mockFindActiveProvidersByPriority(...args),
  findProviderById: (...args: unknown[]): unknown => mockFindProviderById(...args),
}));

const mockDecryptApiKey = jest.fn();

jest.mock('../utils/encryption', () => ({
  decryptApiKey: (...args: unknown[]): unknown => mockDecryptApiKey(...args),
}));

const mockCreateSmmApiClient = jest.fn();

jest.mock('../utils/smm-api-client', () => ({
  createSmmApiClient: (...args: unknown[]): unknown => mockCreateSmmApiClient(...args),
}));

describe('Provider Selector', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return stub client when mode is stub', async () => {
    mockGetConfig.mockReturnValue({ provider: { mode: 'stub', encryptionKey: 'x' } });

    const result = await selectProvider();

    expect(result.providerId).toBeNull();
    expect(result.client).toBeDefined();
    expect(mockFindActiveProvidersByPriority).not.toHaveBeenCalled();
  });

  it('should return real provider when mode is real and providers exist', async () => {
    mockGetConfig.mockReturnValue({ provider: { mode: 'real', encryptionKey: 'x' } });
    mockFindActiveProvidersByPriority.mockResolvedValue([
      {
        id: 'prov-1',
        name: 'Provider 1',
        apiEndpoint: 'https://api.provider.com',
        apiKeyEncrypted: 'iv:tag:encrypted',
        isActive: true,
        priority: 10,
      },
    ]);
    mockDecryptApiKey.mockReturnValue('decrypted-key');
    const mockClient = { submitOrder: jest.fn(), checkStatus: jest.fn() };
    mockCreateSmmApiClient.mockReturnValue(mockClient);

    const result = await selectProvider();

    expect(result.providerId).toBe('prov-1');
    expect(result.client).toBe(mockClient);
    expect(mockDecryptApiKey).toHaveBeenCalledWith('iv:tag:encrypted');
    expect(mockCreateSmmApiClient).toHaveBeenCalledWith({
      apiEndpoint: 'https://api.provider.com',
      apiKey: 'decrypted-key',
    });
  });

  it('should pick highest priority provider', async () => {
    mockGetConfig.mockReturnValue({ provider: { mode: 'real', encryptionKey: 'x' } });
    mockFindActiveProvidersByPriority.mockResolvedValue([
      { id: 'prov-high', apiEndpoint: 'https://high.com', apiKeyEncrypted: 'enc', priority: 20 },
      { id: 'prov-low', apiEndpoint: 'https://low.com', apiKeyEncrypted: 'enc', priority: 5 },
    ]);
    mockDecryptApiKey.mockReturnValue('key');
    mockCreateSmmApiClient.mockReturnValue({ submitOrder: jest.fn(), checkStatus: jest.fn() });

    const result = await selectProvider();

    expect(result.providerId).toBe('prov-high');
  });

  it('should fallback to stub when mode is real but no active providers', async () => {
    mockGetConfig.mockReturnValue({ provider: { mode: 'real', encryptionKey: 'x' } });
    mockFindActiveProvidersByPriority.mockResolvedValue([]);

    const result = await selectProvider();

    expect(result.providerId).toBeNull();
    expect(mockCreateSmmApiClient).not.toHaveBeenCalled();
  });

  it('should call findActiveProvidersByPriority when mode is real', async () => {
    mockGetConfig.mockReturnValue({ provider: { mode: 'real', encryptionKey: 'x' } });
    mockFindActiveProvidersByPriority.mockResolvedValue([]);

    await selectProvider();

    expect(mockFindActiveProvidersByPriority).toHaveBeenCalled();
  });

  it('should return a client with submitOrder and checkStatus', async () => {
    mockGetConfig.mockReturnValue({ provider: { mode: 'stub', encryptionKey: 'x' } });

    const result = await selectProvider();

    expect(typeof result.client.submitOrder).toBe('function');
    expect(typeof result.client.checkStatus).toBe('function');
  });
});

describe('selectProviderById', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return stub client when mode is stub', async () => {
    mockGetConfig.mockReturnValue({ provider: { mode: 'stub', encryptionKey: 'x' } });

    const result = await selectProviderById('prov-1');

    expect(result.providerId).toBeNull();
    expect(result.client).toBeDefined();
    expect(mockFindProviderById).not.toHaveBeenCalled();
  });

  it('should return provider by ID when mode is real', async () => {
    mockGetConfig.mockReturnValue({ provider: { mode: 'real', encryptionKey: 'x' } });
    mockFindProviderById.mockResolvedValue({
      id: 'prov-1',
      apiEndpoint: 'https://api.provider.com',
      apiKeyEncrypted: 'iv:tag:encrypted',
      isActive: true,
    });
    mockDecryptApiKey.mockReturnValue('decrypted-key');
    const mockClient = { submitOrder: jest.fn(), checkStatus: jest.fn() };
    mockCreateSmmApiClient.mockReturnValue(mockClient);

    const result = await selectProviderById('prov-1');

    expect(result.providerId).toBe('prov-1');
    expect(result.client).toBe(mockClient);
    expect(mockFindProviderById).toHaveBeenCalledWith('prov-1');
  });

  it('should throw when provider not found', async () => {
    mockGetConfig.mockReturnValue({ provider: { mode: 'real', encryptionKey: 'x' } });
    mockFindProviderById.mockResolvedValue(null);

    await expect(selectProviderById('bad-id')).rejects.toThrow('Linked provider is not available');
  });

  it('should throw when provider is inactive', async () => {
    mockGetConfig.mockReturnValue({ provider: { mode: 'real', encryptionKey: 'x' } });
    mockFindProviderById.mockResolvedValue({
      id: 'prov-1',
      apiEndpoint: 'https://api.provider.com',
      apiKeyEncrypted: 'enc',
      isActive: false,
    });

    await expect(selectProviderById('prov-1')).rejects.toThrow('Linked provider is not available');
  });
});
