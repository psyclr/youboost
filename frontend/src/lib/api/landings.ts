import { apiRequest, apiRequestValidated } from './client';
import { landingCartCheckoutResultSchema } from './schemas';
import type { LandingCartCheckoutBody, LandingCartCheckoutResult, LandingResponse } from './types';

export const getLanding = (slug: string) =>
  apiRequest<LandingResponse>(`/landing/${encodeURIComponent(slug)}`);

export const checkoutLandingCart = (slug: string, body: LandingCartCheckoutBody) =>
  apiRequestValidated<LandingCartCheckoutResult>(
    `/landing/${encodeURIComponent(slug)}/checkout/cart`,
    landingCartCheckoutResultSchema,
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
  );
