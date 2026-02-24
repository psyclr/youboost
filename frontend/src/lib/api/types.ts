// ============================================
// Enums
// ============================================

export type UserRole = 'USER' | 'RESELLER' | 'ADMIN';
export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'BANNED';
export type Platform = 'YOUTUBE' | 'INSTAGRAM' | 'TIKTOK' | 'TWITTER' | 'FACEBOOK';
export type ServiceType = 'VIEWS' | 'SUBSCRIBERS' | 'LIKES' | 'COMMENTS' | 'SHARES';
export type OrderStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'PARTIAL'
  | 'CANCELLED'
  | 'FAILED'
  | 'REFUNDED';
export type DepositStatus = 'PENDING' | 'CONFIRMED' | 'EXPIRED' | 'FAILED';
export type LedgerType =
  | 'DEPOSIT'
  | 'WITHDRAW'
  | 'HOLD'
  | 'RELEASE'
  | 'REFUND'
  | 'FEE'
  | 'ADMIN_ADJUSTMENT';
export type RateLimitTier = 'BASIC' | 'PRO' | 'ENTERPRISE';
export type WebhookEvent =
  | 'order.created'
  | 'order.completed'
  | 'order.failed'
  | 'order.partial'
  | 'order.cancelled';

// ============================================
// Pagination
// ============================================

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// ============================================
// Auth
// ============================================

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
}

export interface UserProfile {
  userId: string;
  email: string;
  username: string;
  role: UserRole;
  emailVerified: boolean;
  createdAt: string;
}

export interface RegisterInput {
  email: string;
  password: string;
  username: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

// ============================================
// Billing
// ============================================

export interface BalanceResponse {
  userId: string;
  balance: number;
  frozen: number;
  available: number;
  currency: string;
}

export interface DepositInput {
  amount: number;
  cryptoCurrency: 'USDT' | 'BTC' | 'ETH';
}

export interface DepositResponse {
  depositId: string;
  paymentAddress: string;
  amount: number;
  cryptoAmount: number;
  cryptoCurrency: string;
  expiresAt: string;
  status: string;
  qrCode: string;
}

export interface DepositDetail {
  id: string;
  amount: number;
  cryptoAmount: number;
  cryptoCurrency: string;
  paymentAddress: string;
  status: DepositStatus;
  txHash: string | null;
  expiresAt: string;
  confirmedAt: string | null;
  createdAt: string;
}

export interface TransactionSummary {
  id: string;
  type: LedgerType;
  amount: number;
  description: string | null;
  createdAt: string;
}

export interface TransactionDetailed extends TransactionSummary {
  balanceBefore: number;
  balanceAfter: number;
  metadata: unknown;
  referenceType: string | null;
  referenceId: string | null;
}

export interface PaginatedTransactions {
  transactions: TransactionSummary[];
  pagination: Pagination;
}

export interface PaginatedDeposits {
  deposits: DepositDetail[];
  pagination: Pagination;
}

// ============================================
// Catalog
// ============================================

export interface CatalogService {
  id: string;
  name: string;
  description: string | null;
  platform: Platform;
  type: ServiceType;
  pricePer1000: number;
  minQuantity: number;
  maxQuantity: number;
}

export interface PaginatedCatalog {
  services: CatalogService[];
  pagination: Pagination;
}

// ============================================
// Orders
// ============================================

export interface CreateOrderInput {
  serviceId: string;
  link: string;
  quantity: number;
  comments?: string;
}

export interface OrderResponse {
  orderId: string;
  serviceId: string;
  status: OrderStatus;
  quantity: number;
  completed: number;
  price: number;
  createdAt: string;
}

export interface OrderDetailed extends OrderResponse {
  link: string;
  startCount: number | null;
  remains: number | null;
  updatedAt: string;
  comments: string | null;
}

export interface CancelOrderResponse {
  orderId: string;
  status: string;
  refundAmount: number;
  cancelledAt: string;
}

export interface PaginatedOrders {
  orders: OrderResponse[];
  pagination: Pagination;
}

// ============================================
// API Keys
// ============================================

export interface CreateApiKeyInput {
  name: string;
  permissions?: string[];
  rateLimitTier?: RateLimitTier;
  expiresAt?: string;
}

export interface ApiKeyResponse {
  id: string;
  name: string;
  rateLimitTier: RateLimitTier;
  isActive: boolean;
  lastUsedAt: string | null;
  createdAt: string;
  expiresAt: string | null;
}

export interface ApiKeyCreatedResponse extends ApiKeyResponse {
  rawKey: string;
}

export interface PaginatedApiKeys {
  apiKeys: ApiKeyResponse[];
  pagination: Pagination;
}

// ============================================
// Webhooks
// ============================================

export interface CreateWebhookInput {
  url: string;
  events: WebhookEvent[];
}

export interface UpdateWebhookInput {
  url?: string;
  events?: WebhookEvent[];
  isActive?: boolean;
}

export interface WebhookResponse {
  id: string;
  url: string;
  events: WebhookEvent[];
  isActive: boolean;
  lastTriggeredAt: string | null;
  createdAt: string;
}

export interface PaginatedWebhooks {
  webhooks: WebhookResponse[];
  pagination: Pagination;
}

// ============================================
// Admin
// ============================================

export interface AdminUserResponse {
  userId: string;
  email: string;
  username: string;
  role: UserRole;
  status: UserStatus;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdminUserDetailResponse extends AdminUserResponse {
  wallet: {
    balance: number;
    frozen: number;
    available: number;
  } | null;
}

export interface AdminOrderResponse {
  orderId: string;
  userId: string;
  serviceId: string;
  status: OrderStatus;
  quantity: number;
  price: number;
  link: string;
  startCount: number | null;
  remains: number | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface AdminServiceResponse {
  serviceId: string;
  name: string;
  description: string | null;
  platform: Platform;
  type: ServiceType;
  pricePer1000: number;
  minQuantity: number;
  maxQuantity: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardStats {
  totalUsers: number;
  totalOrders: number;
  totalRevenue: number;
  activeServices: number;
  recentOrders: AdminOrderResponse[];
}

export interface PaginatedUsers {
  users: AdminUserResponse[];
  pagination: Pagination;
}

export interface PaginatedAdminOrders {
  orders: AdminOrderResponse[];
  pagination: Pagination;
}

// ============================================
// Error
// ============================================

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
