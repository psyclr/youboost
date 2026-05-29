import { apiRequest } from './client';
import type {
  LandingCalculateBody,
  LandingCalculateResult,
  LandingCartCheckoutBody,
  LandingCartCheckoutResult,
  LandingCheckoutBody,
  LandingCheckoutResult,
  LandingResponse,
} from './types';

export const getLanding = (slug: string) =>
  apiRequest<LandingResponse>(`/landing/${encodeURIComponent(slug)}`);

export const calculateLanding = (slug: string, body: LandingCalculateBody) =>
  apiRequest<LandingCalculateResult>(`/landing/${encodeURIComponent(slug)}/calculate`, {
    method: 'POST',
    body: JSON.stringify(body),
  });

export const checkoutLanding = (slug: string, body: LandingCheckoutBody) =>
  apiRequest<LandingCheckoutResult>(`/landing/${encodeURIComponent(slug)}/checkout`, {
    method: 'POST',
    body: JSON.stringify(body),
  });

export const checkoutLandingCart = (slug: string, body: LandingCartCheckoutBody) =>
  apiRequest<LandingCartCheckoutResult>(`/landing/${encodeURIComponent(slug)}/checkout/cart`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
