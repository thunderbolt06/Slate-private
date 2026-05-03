/**
 * Web Search Provider Constants
 */

import type { WebSearchProviderId, WebSearchProviderConfig } from './types';

/**
 * Web Search Provider Registry
 */
export const WEB_SEARCH_PROVIDERS: Record<WebSearchProviderId, WebSearchProviderConfig> = {
  exa: {
    id: 'exa',
    name: 'Exa',
    requiresApiKey: true,
    defaultBaseUrl: 'https://api.exa.ai',
  },
  tavily: {
    id: 'tavily',
    name: 'Tavily',
    requiresApiKey: true,
    defaultBaseUrl: 'https://api.tavily.com',
  },
};

/**
 * Default order for web-search provider fallback.
 */
export const WEB_SEARCH_FALLBACK_ORDER: readonly WebSearchProviderId[] = ['exa', 'tavily'];

/**
 * Get all available web search providers
 */
export function getAllWebSearchProviders(): WebSearchProviderConfig[] {
  return Object.values(WEB_SEARCH_PROVIDERS);
}
