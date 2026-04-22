/**
 * Google Cloud Service Account Authentication
 *
 * Provides OAuth2 access tokens for all Google/Gemini APIs using a service
 * account, replacing API-key-based authentication.
 *
 * Configuration (pick one):
 *   GOOGLE_SERVICE_ACCOUNT_KEY  – full JSON key content as a string (recommended for containers/Vercel)
 *   GOOGLE_APPLICATION_CREDENTIALS – path to the service account JSON key file (standard ADC)
 *
 * When neither is set, falls back to API-key auth (existing behaviour).
 */

import type { GoogleAuth, OAuth2Client } from 'google-auth-library';

const SCOPES = ['https://www.googleapis.com/auth/cloud-platform'];

// ---------------------------------------------------------------------------
// Singleton auth client
// ---------------------------------------------------------------------------

let _auth: GoogleAuth | null = null;

function getAuth(): GoogleAuth {
  if (_auth) return _auth;

  // Dynamic require keeps google-auth-library out of the client bundle
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { GoogleAuth } = require('google-auth-library') as typeof import('google-auth-library');

  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (keyJson) {
    let credentials: object;
    try {
      credentials = JSON.parse(keyJson);
    } catch {
      throw new Error(
        'GOOGLE_SERVICE_ACCOUNT_KEY is not valid JSON. Paste the full service account key JSON.',
      );
    }
    _auth = new GoogleAuth({ credentials, scopes: SCOPES });
  } else {
    // GOOGLE_APPLICATION_CREDENTIALS is picked up automatically by GoogleAuth
    _auth = new GoogleAuth({ scopes: SCOPES });
  }

  return _auth;
}

// ---------------------------------------------------------------------------
// Token cache (refresh ~1 minute before expiry)
// ---------------------------------------------------------------------------

let _cachedToken: string | null = null;
let _tokenExpiresAt = 0;

/**
 * Returns a valid OAuth2 Bearer token, refreshing when near expiry.
 */
export async function getGoogleAccessToken(): Promise<string> {
  const now = Date.now();
  if (_cachedToken && now < _tokenExpiresAt - 60_000) {
    return _cachedToken;
  }

  const client = (await getAuth().getClient()) as OAuth2Client;
  const response = await client.getAccessToken();

  if (!response.token) {
    throw new Error(
      'Google Cloud authentication failed: could not obtain access token. ' +
        'Check GOOGLE_SERVICE_ACCOUNT_KEY or GOOGLE_APPLICATION_CREDENTIALS.',
    );
  }

  _cachedToken = response.token;
  // Google OAuth2 tokens are valid for 1 hour by default
  _tokenExpiresAt = now + 3_600_000;

  return _cachedToken;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns true when service account credentials are configured.
 * Safe to call synchronously (reads env vars only).
 */
export function isGCloudAuthConfigured(): boolean {
  return !!(
    process.env.GOOGLE_SERVICE_ACCOUNT_KEY || process.env.GOOGLE_APPLICATION_CREDENTIALS
  );
}

/**
 * Builds HTTP headers for an authenticated Google API request using a Bearer token.
 * Replaces the x-goog-api-key header used for API-key auth.
 */
export function buildGCloudHeaders(
  token: string,
  extra?: Record<string, string>,
): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    ...extra,
  };
}

/**
 * Strips the `key=` query parameter that the Generative Language API and some
 * SDKs append when using an API key, so it does not conflict with Bearer auth.
 */
export function stripApiKeyFromUrl(url: string): string {
  return url.replace(/([?&])key=[^&]*(&|$)/, (_, prefix, suffix) =>
    suffix ? prefix : '',
  );
}
