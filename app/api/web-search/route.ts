/**
 * Web Search API
 *
 * POST /api/web-search
 * Simple JSON request/response using Exa search.
 */

import { NextRequest } from 'next/server';
import { callLLM } from '@/lib/ai/llm';
import { searchWithExa, formatSearchResultsAsContext } from '@/lib/web-search/exa';
import { searchWithTavily } from '@/lib/web-search/tavily';
import { WEB_SEARCH_FALLBACK_ORDER } from '@/lib/web-search/constants';
import type { WebSearchProviderId } from '@/lib/web-search/types';
import { resolveWebSearchApiKeyById } from '@/lib/server/provider-config';
import { createLogger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import {
  buildSearchQuery,
  SEARCH_QUERY_REWRITE_EXCERPT_LENGTH,
} from '@/lib/server/search-query-builder';
import { resolveModelFromHeaders } from '@/lib/server/resolve-model';
import { tryWithFallback, buildFallbackOrder } from '@/lib/utils/provider-fallback';
import type { AICallFn } from '@/lib/generation/pipeline-types';
import type { WebSearchResult } from '@/lib/types/web-search';

const log = createLogger('WebSearch');

export async function POST(req: NextRequest) {
  let query: string | undefined;
  try {
    const body = await req.json();
    const {
      query: requestQuery,
      pdfText,
      apiKey: clientApiKey,
      providerId: requestedProvider,
    } = body as {
      query?: string;
      pdfText?: string;
      apiKey?: string;
      providerId?: WebSearchProviderId;
    };
    query = requestQuery;

    if (!query || !query.trim()) {
      return apiError('MISSING_REQUIRED_FIELD', 400, 'query is required');
    }

    const primaryProvider: WebSearchProviderId = requestedProvider || 'exa';

    // Clamp rewrite input at the route boundary; framework body limits still apply to total request size.
    const boundedPdfText = pdfText?.slice(0, SEARCH_QUERY_REWRITE_EXCERPT_LENGTH);

    let aiCall: AICallFn | undefined;
    try {
      const { model: languageModel } = resolveModelFromHeaders(req);
      aiCall = async (systemPrompt, userPrompt) => {
        const result = await callLLM(
          {
            model: languageModel,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
            maxOutputTokens: 256,
          },
          'web-search-query-rewrite',
        );
        return result.text;
      };
    } catch (error) {
      log.warn('Search query rewrite model unavailable, falling back to raw requirement:', error);
    }

    const searchQuery = await buildSearchQuery(query, boundedPdfText, aiCall);

    log.info('Running web search API request', {
      hasPdfContext: searchQuery.hasPdfContext,
      rawRequirementLength: searchQuery.rawRequirementLength,
      rewriteAttempted: searchQuery.rewriteAttempted,
      finalQueryLength: searchQuery.finalQueryLength,
    });

    const fallbackOrder = buildFallbackOrder<WebSearchProviderId>(
      primaryProvider,
      WEB_SEARCH_FALLBACK_ORDER,
    );

    const { result: searchResult, usedProviderId } = await tryWithFallback<WebSearchResult>(
      fallbackOrder,
      async (providerId) => {
        const isPrimary = providerId === primaryProvider;
        const apiKey = resolveWebSearchApiKeyById(
          providerId,
          isPrimary ? clientApiKey : undefined,
        );
        if (!apiKey) {
          throw new Error(`No API key configured for web search provider: ${providerId}`);
        }
        if (providerId === 'exa') {
          return searchWithExa({ query: searchQuery.query, apiKey });
        }
        if (providerId === 'tavily') {
          return searchWithTavily({ query: searchQuery.query, apiKey });
        }
        throw new Error(`Unsupported web search provider: ${providerId}`);
      },
      { category: 'web-search' },
    );

    if (usedProviderId !== primaryProvider) {
      log.warn(`Web search fell back from ${primaryProvider} to ${usedProviderId}`);
    }

    const result = searchResult;
    const context = formatSearchResultsAsContext(result);

    return apiSuccess({
      answer: result.answer,
      sources: result.sources,
      context,
      query: result.query,
      responseTime: result.responseTime,
    });
  } catch (err) {
    log.error(`Web search failed [query="${query?.substring(0, 60) ?? 'unknown'}"]:`, err);
    const message = err instanceof Error ? err.message : 'Web search failed';
    return apiError('INTERNAL_ERROR', 500, message);
  }
}
