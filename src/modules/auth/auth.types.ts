import { z } from 'zod/v4';

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/[a-z]/, 'Password must contain a lowercase letter')
  .regex(/\d/, 'Password must contain a digit');

const usernameSchema = z
  .string()
  .min(3, 'Username must be at least 3 characters')
  .max(30, 'Username must be at most 30 characters')
  .regex(/^\w+$/, 'Username must be alphanumeric or underscore');

export const registerSchema = z.object({
  email: z.email(),
  password: passwordSchema,
  username: usernameSchema,
  referralCode: z.string().min(1).optional(),
});

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export const verifyEmailSchema = z.object({
  token: z.string().min(1),
});

export const forgotPasswordSchema = z.object({
  email: z.email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: passwordSchema,
});

export const setPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: passwordSchema,
});

export const updateProfileSchema = z
  .object({
    username: usernameSchema.optional(),
    currentPassword: z.string().min(1).optional(),
    newPassword: passwordSchema.optional(),
  })
  .refine((data) => !data.newPassword || data.currentPassword, {
    message: 'Current password is required to set a new password',
    path: ['currentPassword'],
  });

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export interface AuthenticatedUser {
  userId: string;
  email: string;
  role: string;
  jti: string;
}

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
  role: string;
  emailVerified: boolean;
  createdAt: Date;
}
