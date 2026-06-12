import { z } from 'zod';

/**
 * Shared strong-password validation chain used across the auth flows
 * (register, reset-password, set-password) and account settings.
 *
 * Messages are kept byte-identical to the previous inline definitions
 * because the e2e suite asserts on them.
 */
export const strongPasswordSchema = z
  .string()
  .min(8, 'At least 8 characters')
  .regex(/[A-Z]/, 'Must contain an uppercase letter')
  .regex(/[a-z]/, 'Must contain a lowercase letter')
  .regex(/\d/, 'Must contain a digit');
