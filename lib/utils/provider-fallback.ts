/**
 * Generic provider fallback runner.
 *
 * Given an ordered list of provider IDs and a per-provider try function, runs them
 * in order and returns the first success. If a provider throws, the error is recorded
 * and the next one is tried. If all fail, an aggregated error is thrown.
 *
 * Used by every external provider category (TTS, ASR, image, video, LLM, web search)
 * so the UX falls back through alternates instead of failing on the first hiccup.
 */

import { createLogger } from '@/lib/logger';

const log = createLogger('ProviderFallback');

export interface ProviderAttempt {
  providerId: string;
  error: string;
}

export interface FallbackResult<T> {
  result: T;
  usedProviderId: string;
  attempts: ProviderAttempt[];
}

export class AllProvidersFailedError extends Error {
  constructor(
    public readonly category: string,
    public readonly attempts: ProviderAttempt[],
  ) {
    super(
      `All ${category} providers failed: ${attempts.map((a) => `${a.providerId} (${a.error})`).join('; ')}`,
    );
    this.name = 'AllProvidersFailedError';
  }
}

export interface TryWithFallbackOptions {
  category: string;
  /** Optional predicate - return false to abort fallback (e.g. content-policy errors). */
  shouldFallback?: (error: unknown, providerId: string) => boolean;
}

export async function tryWithFallback<T>(
  providerIds: readonly string[],
  tryProvider: (providerId: string) => Promise<T>,
  options: TryWithFallbackOptions,
): Promise<FallbackResult<T>> {
  if (providerIds.length === 0) {
    throw new Error(`tryWithFallback[${options.category}]: empty providerIds list`);
  }

  const attempts: ProviderAttempt[] = [];
  for (let i = 0; i < providerIds.length; i++) {
    const providerId = providerIds[i];
    try {
      const result = await tryProvider(providerId);
      if (i > 0) {
        log.info(
          `[${options.category}] Fell back to ${providerId} after ${i} failure(s): ${attempts
            .map((a) => `${a.providerId}(${a.error})`)
            .join(', ')}`,
        );
      }
      return { result, usedProviderId: providerId, attempts };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      attempts.push({ providerId, error: message });

      if (options.shouldFallback && !options.shouldFallback(err, providerId)) {
        log.warn(
          `[${options.category}] Provider ${providerId} failed with non-fallback error; aborting fallback`,
          err,
        );
        throw err;
      }

      const isLast = i === providerIds.length - 1;
      log.warn(
        `[${options.category}] Provider ${providerId} failed${isLast ? '' : '; trying next'}: ${message}`,
      );
    }
  }

  throw new AllProvidersFailedError(options.category, attempts);
}

/**
 * Build an ordered fallback list. The primary (currently selected) provider is tried
 * first, then the rest of `defaultOrder` in declared order, with `excluded` removed
 * (e.g. browser-only providers when running server-side).
 */
export function buildFallbackOrder<T extends string>(
  primary: T | undefined,
  defaultOrder: readonly T[],
  excluded: readonly T[] = [],
): T[] {
  const seen = new Set<T>();
  const order: T[] = [];

  if (primary && !excluded.includes(primary)) {
    order.push(primary);
    seen.add(primary);
  }
  for (const id of defaultOrder) {
    if (excluded.includes(id) || seen.has(id)) continue;
    order.push(id);
    seen.add(id);
  }
  return order;
}
