import { z } from 'zod/v4';

export const createTrackingLinkSchema = z.object({
  code: z
    .string()
    .min(3)
    .max(50)
    .regex(/^[a-zA-Z0-9_-]+$/),
  name: z.string().min(1).max(255),
});

export const trackingLinkIdSchema = z.object({
  linkId: z.uuid(),
});

export type CreateTrackingLinkInput = z.infer<typeof createTrackingLinkSchema>;

export interface TrackingLinkWithStats {
  id: string;
  code: string;
  name: string;
  createdAt: Date;
  registrations: number;
  lastRegistration: Date | null;
}
