import { apiRequest } from './client';

export interface ReferralBonusSummary {
  id: string;
  referredUsername: string;
  amount: number;
  status: string;
  createdAt: string;
}

export interface ReferralStats {
  referralCode: string;
  totalReferred: number;
  totalEarned: number;
  bonuses: ReferralBonusSummary[];
}

export const getReferralCode = () => apiRequest<{ referralCode: string }>('/referrals/code');

export const getReferralStats = () => apiRequest<ReferralStats>('/referrals/stats');
