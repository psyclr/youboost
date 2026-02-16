const STATUS_MAP: Record<string, string> = {
  completed: 'COMPLETED',
  Completed: 'COMPLETED',
  partial: 'PARTIAL',
  Partial: 'PARTIAL',
  canceled: 'CANCELLED',
  Canceled: 'CANCELLED',
  cancelled: 'CANCELLED',
  Cancelled: 'CANCELLED',
  'in progress': 'PROCESSING',
  'In progress': 'PROCESSING',
  pending: 'PROCESSING',
  Pending: 'PROCESSING',
  processing: 'PROCESSING',
  Processing: 'PROCESSING',
  error: 'FAILED',
  Error: 'FAILED',
  fail: 'FAILED',
  Fail: 'FAILED',
};

const TERMINAL_STATUSES = new Set(['COMPLETED', 'PARTIAL', 'FAILED', 'CANCELLED', 'REFUNDED']);

export function mapProviderStatus(providerStatus: string): string {
  return STATUS_MAP[providerStatus] ?? 'PROCESSING';
}

export function isTerminalStatus(status: string): boolean {
  return TERMINAL_STATUSES.has(status);
}
