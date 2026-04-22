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

// IMPORTANT: This module is imported by some client-safe code paths.
// To avoid bundling Node-only dependencies like `child_process` into the browser,
// we must not use static imports or literal-string requires for `google-auth-library`.
type GoogleAuthLike = {
  getClient(): Promise<unknown>;
};
type OAuth2ClientLike = {
  getAccessToken(): Promise<{ token?: string | null }>;
};

const SCOPES = ['https://www.googleapis.com/auth/cloud-platform'];

// ---------------------------------------------------------------------------
// Singleton auth client
// ---------------------------------------------------------------------------

let _auth: GoogleAuthLike | null = null;

function getAuth(): GoogleAuthLike {
  if (_auth) return _auth;

  // NOTE: This file can be pulled into client-safe import graphs.
  // Use eval('require') so Next doesn't bundle Node-only deps for the browser.
  const req = eval('require') as (id: string) => unknown;
  const { GoogleAuth } = req('google-auth-library') as {
    GoogleAuth: new (args: { credentials?: object; scopes: string[] }) => GoogleAuthLike;
  };

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

  const client = (await getAuth().getClient()) as OAuth2ClientLike;
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
 * Returns the Google Cloud project ID for billing / request routing.
 * Resolution order:
 *   1. GOOGLE_CLOUD_PROJECT env var
 *   2. project_id inside GOOGLE_SERVICE_ACCOUNT_KEY JSON
 *   3. undefined (caller should treat as optional)
 */
export function getGoogleProjectId(): string | undefined {
  if (process.env.GOOGLE_CLOUD_PROJECT) return process.env.GOOGLE_CLOUD_PROJECT;
  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (keyJson) {
    try {
      const parsed = JSON.parse(keyJson) as { project_id?: string };
      if (parsed.project_id) return parsed.project_id;
    } catch {
      // ignore parse errors here
    }
  }
  return undefined;
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
