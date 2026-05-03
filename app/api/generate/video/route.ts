/**
 * Video Generation API
 *
 * Generates a video from a text prompt using the specified provider.
 * Uses async task pattern (submit → poll) so maxDuration is set to 5 minutes.
 *
 * POST /api/generate/video
 *
 * Headers:
 *   x-video-provider: VideoProviderId (default: 'seedance')
 *   x-video-model: string (optional model override)
 *   x-api-key: string (optional, server fallback)
 *   x-base-url: string (optional, server fallback)
 *
 * Body: { prompt, duration?, aspectRatio?, resolution? }
 * Response: { success: boolean, result?: VideoGenerationResult, error?: string }
 */

import { NextRequest } from 'next/server';
import {
  generateVideo,
  normalizeVideoOptions,
  VIDEO_FALLBACK_ORDER,
} from '@/lib/media/video-providers';
import { resolveVideoApiKey, resolveVideoBaseUrl } from '@/lib/server/provider-config';
import type { VideoProviderId, VideoGenerationOptions } from '@/lib/media/types';
import { createLogger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import { validateUrlForSSRF } from '@/lib/server/ssrf-guard';
import { tryWithFallback, buildFallbackOrder } from '@/lib/utils/provider-fallback';

const log = createLogger('VideoGeneration API');

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as VideoGenerationOptions;

    if (!body.prompt) {
      return apiError('MISSING_REQUIRED_FIELD', 400, 'Missing prompt');
    }

    const providerId = (request.headers.get('x-video-provider') || 'seedance') as VideoProviderId;
    const clientApiKey = request.headers.get('x-api-key') || undefined;
    const clientBaseUrl = request.headers.get('x-base-url') || undefined;
    const clientModel = request.headers.get('x-video-model') || undefined;

    if (clientBaseUrl && process.env.NODE_ENV === 'production') {
      const ssrfError = validateUrlForSSRF(clientBaseUrl);
      if (ssrfError) {
        return apiError('INVALID_URL', 403, ssrfError);
      }
    }

    log.info(
      `Generating video: provider=${providerId}, model=${clientModel || 'default'}, ` +
        `prompt="${body.prompt.slice(0, 80)}..."`,
    );

    const fallbackOrder = buildFallbackOrder<VideoProviderId>(providerId, VIDEO_FALLBACK_ORDER);

    const { result, usedProviderId } = await tryWithFallback(
      fallbackOrder,
      async (id) => {
        const isPrimary = id === providerId;
        const resolvedKey =
          isPrimary && clientBaseUrl
            ? clientApiKey || ''
            : resolveVideoApiKey(id, isPrimary ? clientApiKey : undefined);

        if (!resolvedKey) {
          throw new Error(`No API key configured for video provider: ${id}`);
        }

        const resolvedBaseUrl =
          isPrimary && clientBaseUrl ? clientBaseUrl : resolveVideoBaseUrl(id, undefined);

        // Capabilities differ across video providers - re-normalize per provider.
        const options = normalizeVideoOptions(id as VideoProviderId, body);

        return generateVideo(
          {
            providerId: id as VideoProviderId,
            apiKey: resolvedKey,
            baseUrl: resolvedBaseUrl,
            model: isPrimary ? clientModel : undefined,
          },
          options,
        );
      },
      {
        category: 'video',
        shouldFallback: (err) => {
          const msg = err instanceof Error ? err.message : String(err);
          return !(msg.includes('SensitiveContent') || msg.includes('sensitive information'));
        },
      },
    );

    if (usedProviderId !== providerId) {
      log.warn(`Video generation fell back from ${providerId} to ${usedProviderId}`);
    }

    log.info(
      `Video generated: url=${result.url ? 'yes' : 'no'}, ${result.width}x${result.height}, ${result.duration}s`,
    );

    return apiSuccess({ result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // Detect content safety filter rejections (e.g. Seedance SensitiveContent errors)
    if (message.includes('SensitiveContent') || message.includes('sensitive information')) {
      log.warn(`Video blocked by content safety filter: ${message}`);
      return apiError('CONTENT_SENSITIVE', 400, message);
    }
    log.error(
      `Video generation failed [provider=${request.headers.get('x-video-provider') ?? 'kling'}, model=${request.headers.get('x-video-model') ?? 'default'}]:`,
      error,
    );
    return apiError('INTERNAL_ERROR', 500, message);
  }
}
