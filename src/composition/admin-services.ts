import type { Logger } from 'pino';
import type { PrismaClient } from '../generated/prisma';
import { createServiceLogger } from '../shared/utils/logger';
import type { UserRepository } from '../modules/auth';
import type {
  BillingInternalService,
  WalletRepository,
  LedgerRepository,
  DepositRepository,
} from '../modules/billing';
import type { OrdersRepository, ServicesRepository } from '../modules/orders';
import type { ProvidersRepository } from '../modules/providers';
import { createAdminDashboardRepository } from '../modules/admin/admin-dashboard.repository';
import {
  createAdminDashboardService,
  type AdminDashboardService,
} from '../modules/admin/admin-dashboard.service';
import {
  createAdminBillingService,
  type AdminBillingService,
} from '../modules/admin/admin-billing.service';
import {
  createAdminDepositsService,
  type AdminDepositsService,
} from '../modules/admin/admin-deposits.service';
import {
  createAdminOrdersService,
  type AdminOrdersService,
} from '../modules/admin/admin-orders.service';
import {
  createAdminServicesService,
  type AdminServicesService,
} from '../modules/admin/admin-services.service';
import {
  createAdminUsersService,
  type AdminUsersService,
} from '../modules/admin/admin-users.service';

export interface AdminServices {
  dashboardService: AdminDashboardService;
  billingService: AdminBillingService;
  depositsService: AdminDepositsService;
  ordersService: AdminOrdersService;
  servicesService: AdminServicesService;
  usersService: AdminUsersService;
}

export interface BuildAdminServicesDeps {
  prisma: PrismaClient;
  userRepo: UserRepository;
  walletRepo: WalletRepository;
  ledgerRepo: LedgerRepository;
  depositRepo: DepositRepository;
  ordersRepo: OrdersRepository;
  servicesRepo: ServicesRepository;
  providersRepo: ProvidersRepository;
  billingInternal: BillingInternalService;
  loggerFactory?: (name: string) => Logger;
}

export function buildAdminServices(deps: BuildAdminServicesDeps): AdminServices {
  const logger = deps.loggerFactory ?? createServiceLogger;
  const dashboardRepo = createAdminDashboardRepository(deps.prisma);

  return {
    dashboardService: createAdminDashboardService({
      dashboardRepo,
      logger: logger('admin-dashboard'),
    }),
    billingService: createAdminBillingService({
      adjustBalance: deps.billingInternal.adjustBalance,
      logger: logger('admin-billing'),
    }),
    depositsService: createAdminDepositsService({
      prisma: deps.prisma,
      depositRepo: deps.depositRepo,
      walletRepo: deps.walletRepo,
      ledgerRepo: deps.ledgerRepo,
      logger: logger('admin-deposits'),
    }),
    ordersService: createAdminOrdersService({
      ordersRepo: deps.ordersRepo,
      billing: {
        chargeFunds: deps.billingInternal.chargeFunds,
        releaseFunds: deps.billingInternal.releaseFunds,
        refundFunds: deps.billingInternal.refundFunds,
      },
      logger: logger('admin-orders'),
    }),
    servicesService: createAdminServicesService({
      servicesRepo: deps.servicesRepo,
      providersRepo: deps.providersRepo,
      logger: logger('admin-services'),
    }),
    usersService: createAdminUsersService({
      userRepo: deps.userRepo,
      walletRepo: deps.walletRepo,
      logger: logger('admin-users'),
    }),
  };
}
