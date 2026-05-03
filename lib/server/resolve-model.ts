/**
 * Shared model resolution utilities for API routes.
 *
 * Extracts the repeated parseModelString → resolveApiKey → resolveBaseUrl →
 * resolveProxy → getModel boilerplate into a single call.
 */

import type { NextRequest } from 'next/server';
import {
  getModel,
  getDefaultModelId,
  LLM_FALLBACK_ORDER,
  parseModelString,
  type ModelWithInfo,
} from '@/lib/ai/providers';
import type { ProviderId } from '@/lib/types/provider';
import { resolveApiKey, resolveBaseUrl, resolveProxy } from '@/lib/server/provider-config';
import { validateUrlForSSRF } from '@/lib/server/ssrf-guard';

export interface ResolvedModel extends ModelWithInfo {
  /** Original model string (e.g. "openai/gpt-4o-mini") */
  modelString: string;
  /** Effective API key after server-side fallback resolution */
  apiKey: string;
}

/**
 * Resolve a language model from explicit parameters.
 *
 * Use this when model config comes from the request body.
 */
export function resolveModel(params: {
  modelString?: string;
  apiKey?: string;
  baseUrl?: string;
  providerType?: string;
  requiresApiKey?: boolean;
}): ResolvedModel {
  const modelString =
    params.modelString || process.env.DEFAULT_MODEL || 'google:gemini-3.1-flash-lite-preview';
  const { providerId, modelId } = parseModelString(modelString);

  const clientBaseUrl = params.baseUrl || undefined;
  if (clientBaseUrl && process.env.NODE_ENV === 'production') {
    const ssrfError = validateUrlForSSRF(clientBaseUrl);
    if (ssrfError) {
      throw new Error(ssrfError);
    }
  }

  const apiKey = clientBaseUrl
    ? params.apiKey || ''
    : resolveApiKey(providerId, params.apiKey || '');
  const baseUrl = clientBaseUrl ? clientBaseUrl : resolveBaseUrl(providerId, params.baseUrl);
  const proxy = resolveProxy(providerId);
  const { model, modelInfo } = getModel({
    providerId,
    modelId,
    apiKey,
    baseUrl,
    proxy,
    providerType: params.providerType as 'openai' | 'anthropic' | 'google' | undefined,
    requiresApiKey: params.requiresApiKey,
  });

  return { model, modelInfo, modelString, apiKey };
}

/**
 * Resolve a language model from standard request headers.
 *
 * Reads: x-model, x-api-key, x-base-url, x-provider-type, x-requires-api-key
 */
export function resolveModelFromHeaders(req: NextRequest): ResolvedModel {
  return resolveModel({
    modelString: req.headers.get('x-model') || undefined,
    apiKey: req.headers.get('x-api-key') || undefined,
    baseUrl: req.headers.get('x-base-url') || undefined,
    providerType: req.headers.get('x-provider-type') || undefined,
    requiresApiKey: req.headers.get('x-requires-api-key') === 'true' ? true : undefined,
  });
}

/**
 * Build an ordered list of resolved fallback models for LLM calls.
 *
 * The primary model (the one the caller asked for) is first; subsequent entries
 * come from `LLM_FALLBACK_ORDER`, each using its provider's first declared model.
 * Providers that have no server-resolvable API key are skipped - there's no point
 * including a model we can't authenticate against.
 */
export function resolveLLMFallbackChain(primary: ResolvedModel): ResolvedModel[] {
  const { providerId: primaryProviderId } = parseModelString(primary.modelString);
  const chain: ResolvedModel[] = [primary];
  const seen = new Set<string>([primary.modelString]);

  for (const providerId of LLM_FALLBACK_ORDER) {
    if (providerId === primaryProviderId) continue;
    const modelId = getDefaultModelId(providerId as ProviderId);
    if (!modelId) continue;
    const modelString = `${providerId}:${modelId}`;
    if (seen.has(modelString)) continue;

    const apiKey = resolveApiKey(providerId);
    if (!apiKey) continue; // No creds - skip silently.

    try {
      const resolved = resolveModel({ modelString });
      chain.push(resolved);
      seen.add(modelString);
    } catch {
      // resolveModel can throw on SSRF/missing config - just drop this fallback.
    }
  }

  return chain;
}
