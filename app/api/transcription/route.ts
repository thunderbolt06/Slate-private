import { NextRequest } from 'next/server';
import { transcribeAudio } from '@/lib/audio/asr-providers';
import { ASR_FALLBACK_ORDER, ASR_PROVIDERS } from '@/lib/audio/constants';
import { resolveASRApiKey, resolveASRBaseUrl } from '@/lib/server/provider-config';
import type { ASRProviderId } from '@/lib/audio/types';
import { createLogger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import { validateUrlForSSRF } from '@/lib/server/ssrf-guard';
import { tryWithFallback, buildFallbackOrder } from '@/lib/utils/provider-fallback';
const log = createLogger('Transcription');

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  let resolvedProviderId: string | undefined;
  let resolvedModelId: string | undefined;
  try {
    const formData = await req.formData();
    const audioFile = formData.get('audio') as File;
    const providerId = formData.get('providerId') as ASRProviderId | null;
    const modelId = formData.get('modelId') as string | null;
    const language = formData.get('language') as string | null;
    const apiKey = formData.get('apiKey') as string | null;
    const baseUrl = formData.get('baseUrl') as string | null;

    if (!audioFile) {
      return apiError('MISSING_REQUIRED_FIELD', 400, 'Audio file is required');
    }

    // providerId is required from the client - no server-side store to fall back to
    const effectiveProviderId = providerId || ('openai-whisper' as ASRProviderId);
    resolvedProviderId = effectiveProviderId;
    resolvedModelId = modelId ?? undefined;

    const clientBaseUrl = baseUrl || undefined;
    if (clientBaseUrl && process.env.NODE_ENV === 'production') {
      const ssrfError = validateUrlForSSRF(clientBaseUrl);
      if (ssrfError) {
        return apiError('INVALID_URL', 403, ssrfError);
      }
    }

    const fallbackOrder = buildFallbackOrder<ASRProviderId>(
      effectiveProviderId,
      ASR_FALLBACK_ORDER,
      ['browser-native'],
    );

    const { result, usedProviderId } = await tryWithFallback(
      fallbackOrder,
      async (providerId) => {
        const isPrimary = providerId === effectiveProviderId;
        const resolvedKey =
          isPrimary && clientBaseUrl
            ? apiKey || ''
            : resolveASRApiKey(providerId, isPrimary ? apiKey || undefined : undefined);

        if (ASR_PROVIDERS[providerId as ASRProviderId]?.requiresApiKey && !resolvedKey) {
          throw new Error(`No API key configured for ASR provider: ${providerId}`);
        }

        const resolvedBaseUrl =
          isPrimary && clientBaseUrl
            ? clientBaseUrl
            : resolveASRBaseUrl(providerId, isPrimary ? baseUrl || undefined : undefined);

        return transcribeAudio(
          {
            providerId: providerId as ASRProviderId,
            modelId: isPrimary ? modelId || undefined : undefined,
            language: language || 'auto',
            apiKey: resolvedKey,
            baseUrl: resolvedBaseUrl,
          },
          audioFile,
        );
      },
      { category: 'asr' },
    );

    if (usedProviderId !== effectiveProviderId) {
      log.warn(`ASR fell back from ${effectiveProviderId} to ${usedProviderId}`);
    }

    return apiSuccess({ text: result.text });
  } catch (error) {
    log.error(
      `Transcription failed [provider=${resolvedProviderId ?? 'unknown'}, model=${resolvedModelId ?? 'default'}]:`,
      error,
    );
    return apiError(
      'TRANSCRIPTION_FAILED',
      500,
      'Transcription failed',
      error instanceof Error ? error.message : 'Unknown error',
    );
  }
}
