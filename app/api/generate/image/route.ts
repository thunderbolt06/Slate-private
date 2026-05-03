/**
 * Image Generation API
 *
 * Generates an image from a text prompt using the specified provider.
 * Called by the client during media generation after slides are produced.
 *
 * POST /api/generate/image
 *
 * Headers:
 *   x-image-provider: ImageProviderId (default: 'seedream')
 *   x-api-key: string (optional, server fallback)
 *   x-base-url: string (optional, server fallback)
 *
 * Body: { prompt, negativePrompt?, width?, height?, aspectRatio?, style? }
 * Response: { success: boolean, result?: ImageGenerationResult, error?: string }
 */

import { NextRequest } from 'next/server';
import {
  generateImage,
  aspectRatioToDimensions,
  IMAGE_FALLBACK_ORDER,
} from '@/lib/media/image-providers';
import { sanitizeImagePrompt } from '@/lib/media/image-prompt-sanitizer';
import { resolveImageApiKey, resolveImageBaseUrl } from '@/lib/server/provider-config';
import type { ImageProviderId, ImageGenerationOptions } from '@/lib/media/types';
import { createLogger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import { validateUrlForSSRF } from '@/lib/server/ssrf-guard';
import { tryWithFallback, buildFallbackOrder } from '@/lib/utils/provider-fallback';

const log = createLogger('ImageGeneration API');

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ImageGenerationOptions;

    if (!body.prompt) {
      return apiError('MISSING_REQUIRED_FIELD', 400, 'Missing prompt');
    }

    // NEW-002: scrub stock-template / placeholder-text fragments before they
    // reach the image model. Even with strict outline-AI instructions the
    // prompt occasionally still contains "[YOUR NAME/COMPANY]" boilerplate
    // that the image model renders verbatim.
    body.prompt = sanitizeImagePrompt(body.prompt);

    const providerId = (request.headers.get('x-image-provider') || 'seedream') as ImageProviderId;
    const clientApiKey = request.headers.get('x-api-key') || undefined;
    const clientBaseUrl = request.headers.get('x-base-url') || undefined;
    const clientModel = request.headers.get('x-image-model') || undefined;

    if (clientBaseUrl && process.env.NODE_ENV === 'production') {
      const ssrfError = validateUrlForSSRF(clientBaseUrl);
      if (ssrfError) {
        return apiError('INVALID_URL', 403, ssrfError);
      }
    }

    // Resolve dimensions from aspect ratio if not explicitly set
    if (!body.width && !body.height && body.aspectRatio) {
      const dims = aspectRatioToDimensions(body.aspectRatio);
      body.width = dims.width;
      body.height = dims.height;
    }

    log.info(
      `Generating image: provider=${providerId}, model=${clientModel || 'default'}, ` +
        `prompt="${body.prompt.slice(0, 80)}...", size=${body.width ?? 'auto'}x${body.height ?? 'auto'}`,
    );

    const fallbackOrder = buildFallbackOrder<ImageProviderId>(providerId, IMAGE_FALLBACK_ORDER);

    const { result, usedProviderId } = await tryWithFallback(
      fallbackOrder,
      async (id) => {
        const isPrimary = id === providerId;
        const resolvedKey =
          isPrimary && clientBaseUrl
            ? clientApiKey || ''
            : resolveImageApiKey(id, isPrimary ? clientApiKey : undefined);

        if (!resolvedKey) {
          throw new Error(`No API key configured for image provider: ${id}`);
        }

        const resolvedBaseUrl =
          isPrimary && clientBaseUrl ? clientBaseUrl : resolveImageBaseUrl(id, undefined);

        return generateImage(
          {
            providerId: id as ImageProviderId,
            apiKey: resolvedKey,
            baseUrl: resolvedBaseUrl,
            model: isPrimary ? clientModel : undefined,
          },
          body,
        );
      },
      {
        category: 'image',
        // Don't fall back on content-policy refusals - every provider will reject the same prompt.
        shouldFallback: (err) => {
          const msg = err instanceof Error ? err.message : String(err);
          return !(msg.includes('SensitiveContent') || msg.includes('sensitive information'));
        },
      },
    );

    if (usedProviderId !== providerId) {
      log.warn(`Image generation fell back from ${providerId} to ${usedProviderId}`);
    }

    return apiSuccess({ result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // Detect content safety filter rejections (e.g. Seedream OutputImageSensitiveContentDetected)
    if (message.includes('SensitiveContent') || message.includes('sensitive information')) {
      log.warn(`Image blocked by content safety filter: ${message}`);
      return apiError('CONTENT_SENSITIVE', 400, message);
    }
    log.error(
      `Image generation failed [provider=${request.headers.get('x-image-provider') ?? 'seedream'}, model=${request.headers.get('x-image-model') ?? 'default'}]:`,
      error,
    );
    return apiError('INTERNAL_ERROR', 500, message);
  }
}
