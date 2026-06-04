import { apiRequest } from './client';
import type { LandingCartCheckoutBody, LandingCartCheckoutResult, LandingResponse } from './types';

export const getLanding = (slug: string) =>
  apiRequest<LandingResponse>(`/landing/${encodeURIComponent(slug)}`);

export const checkoutLandingCart = (slug: string, body: LandingCartCheckoutBody) =>
  apiRequest<LandingCartCheckoutResult>(`/landing/${encodeURIComponent(slug)}/checkout/cart`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
