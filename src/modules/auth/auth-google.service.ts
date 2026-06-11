import { randomBytes } from 'node:crypto';
import type Redis from 'ioredis';
import { OAuth2Client } from 'google-auth-library';
import { UnauthorizedError } from '../../shared/errors';

export interface GoogleProfile {
  googleId: string;
  email: string;
  emailVerified: boolean;
}

export interface OAuthState {
  /** Random value passed to Google and back via the `state` query param. */
  state: string;
  /** Random value stored in an httpOnly cookie to bind the flow to one browser. */
  nonce: string;
}

export interface AuthGoogleService {
  buildAuthUrl(state: string): string;
  isConfigured(): boolean;
  createState(): Promise<OAuthState>;
  consumeState(state: string, nonce: string | undefined): Promise<boolean>;
  exchangeCode(code: string): Promise<GoogleProfile>;
}

export interface AuthGoogleServiceDeps {
  config: { clientId: string; clientSecret: string; redirectUri: string };
  redis: Redis;
  // Injected for testability; defaults to a real OAuth2Client in the factory below.
  oauthClient?: Pick<OAuth2Client, 'getToken' | 'verifyIdToken' | 'generateAuthUrl'>;
}

const STATE_TTL_SECONDS = 600;
const stateKey = (state: string): string => `oauth:state:${state}`;

export function createAuthGoogleService(deps: AuthGoogleServiceDeps): AuthGoogleService {
  const { config, redis } = deps;
  const client =
    deps.oauthClient ?? new OAuth2Client(config.clientId, config.clientSecret, config.redirectUri);

  function buildAuthUrl(state: string): string {
    return (client as OAuth2Client).generateAuthUrl({
      access_type: 'online',
      scope: ['openid', 'email', 'profile'],
      state,
      prompt: 'select_account',
    });
  }

  function isConfigured(): boolean {
    return Boolean(config.clientId && config.clientSecret && config.redirectUri);
  }

  async function createState(): Promise<OAuthState> {
    const state = randomBytes(32).toString('hex');
    const nonce = randomBytes(16).toString('hex');
    await redis.set(stateKey(state), nonce, 'EX', STATE_TTL_SECONDS);
    return { state, nonce };
  }

  async function consumeState(state: string, nonce: string | undefined): Promise<boolean> {
    if (!state) return false;
    // getdel burns the state even on a nonce mismatch or missing nonce —
    // single-use either way, so a presented state can never be retried.
    const storedNonce = await redis.getdel(stateKey(state));
    return storedNonce !== null && nonce !== undefined && storedNonce === nonce;
  }

  async function exchangeCode(code: string): Promise<GoogleProfile> {
    const { tokens } = await client.getToken(code);
    const idToken = tokens.id_token;
    if (!idToken) {
      throw new UnauthorizedError('Google did not return an id_token', 'GOOGLE_AUTH_FAILED');
    }
    const ticket = await client.verifyIdToken({ idToken, audience: config.clientId });
    const payload = ticket.getPayload();
    if (!payload?.sub || !payload.email) {
      throw new UnauthorizedError('Google profile missing email', 'GOOGLE_AUTH_FAILED');
    }
    return {
      googleId: payload.sub,
      email: payload.email,
      emailVerified: Boolean(payload.email_verified),
    };
  }

  return { buildAuthUrl, isConfigured, createState, consumeState, exchangeCode };
}
