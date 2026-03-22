import { z } from 'zod/v4';

export const referralCodeSchema = z.object({
  code: z
    .string()
    .min(3)
    .max(20)
    .regex(/^[a-zA-Z0-9]+$/),
});

export interface ReferralStats {
  referralCode: string;
  totalReferred: number;
  totalEarned: number;
  bonuses: ReferralBonusSummary[];
}

export interface ReferralBonusSummary {
  id: string;
  referredUsername: string;
  amount: number;
  status: string;
  createdAt: Date;
}
