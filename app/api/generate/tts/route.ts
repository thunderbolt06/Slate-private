/**
 * Single TTS Generation API
 *
 * Generates TTS audio for a single text string and returns base64-encoded audio.
 * Called by the client in parallel for each speech action after a scene is generated.
 *
 * POST /api/generate/tts
 */

import { NextRequest } from 'next/server';
import { generateTTS } from '@/lib/audio/tts-providers';
import { TTS_FALLBACK_ORDER, TTS_PROVIDERS } from '@/lib/audio/constants';
import { resolveTTSApiKey, resolveTTSBaseUrl } from '@/lib/server/provider-config';
import type { TTSProviderId } from '@/lib/audio/types';
import { createLogger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import { validateUrlForSSRF } from '@/lib/server/ssrf-guard';
import { createAdminClient } from '@/utils/supabase/admin';
import { tryWithFallback, buildFallbackOrder } from '@/lib/utils/provider-fallback';

const log = createLogger('TTS API');

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  let ttsProviderId: string | undefined;
  let ttsVoice: string | undefined;
  let audioId: string | undefined;
  try {
    const body = await req.json();
    const { text, ttsModelId, ttsSpeed, ttsApiKey, ttsBaseUrl, stageId } = body as {
      text: string;
      audioId: string;
      ttsProviderId: TTSProviderId;
      ttsModelId?: string;
      ttsVoice: string;
      ttsSpeed?: number;
      ttsApiKey?: string;
      ttsBaseUrl?: string;
      stageId?: string;
    };
    ttsProviderId = body.ttsProviderId;
    ttsVoice = body.ttsVoice;
    audioId = body.audioId;

    // Validate required fields
    if (!text || !audioId || !ttsProviderId || !ttsVoice) {
      return apiError(
        'MISSING_REQUIRED_FIELD',
        400,
        'Missing required fields: text, audioId, ttsProviderId, ttsVoice',
      );
    }

    // Reject browser-native TTS - must be handled client-side
    if (ttsProviderId === 'browser-native-tts') {
      return apiError('INVALID_REQUEST', 400, 'browser-native-tts must be handled client-side');
    }

    const clientBaseUrl = ttsBaseUrl || undefined;
    if (clientBaseUrl && process.env.NODE_ENV === 'production') {
      const ssrfError = validateUrlForSSRF(clientBaseUrl);
      if (ssrfError) {
        return apiError('INVALID_URL', 403, ssrfError);
      }
    }

    log.info(
      `Generating TTS: provider=${ttsProviderId}, model=${ttsModelId || 'default'}, voice=${ttsVoice}, audioId=${audioId}, textLen=${text.length}`,
    );

    // Build the fallback chain: primary first, then registered alternates.
    // When the client supplied a custom baseUrl, we trust their key/base for the
    // primary attempt; subsequent fallbacks resolve their own server-side creds.
    // Capture as non-nullable locals - narrowing doesn't carry into the async callback.
    const primaryProviderId: TTSProviderId = ttsProviderId as TTSProviderId;
    const primaryVoice: string = ttsVoice;

    const fallbackOrder = buildFallbackOrder<TTSProviderId>(
      primaryProviderId,
      TTS_FALLBACK_ORDER,
      ['browser-native-tts'],
    );

    const { result, usedProviderId: chainProviderId } = await tryWithFallback(
      fallbackOrder,
      async (providerId) => {
        const isPrimary = providerId === primaryProviderId;
        const apiKey =
          isPrimary && clientBaseUrl
            ? ttsApiKey || ''
            : resolveTTSApiKey(providerId, isPrimary ? ttsApiKey || undefined : undefined);

        if (TTS_PROVIDERS[providerId as TTSProviderId]?.requiresApiKey && !apiKey) {
          throw new Error(`No API key configured for TTS provider: ${providerId}`);
        }

        const baseUrl =
          isPrimary && clientBaseUrl
            ? clientBaseUrl
            : resolveTTSBaseUrl(providerId, isPrimary ? ttsBaseUrl || undefined : undefined);

        // Voice/model only valid for the primary provider; alternates use defaults.
        const providerDef = TTS_PROVIDERS[providerId as TTSProviderId];
        const voiceForCall: string = isPrimary
          ? primaryVoice
          : providerDef?.voices[0]?.id || primaryVoice;
        const modelForCall = isPrimary ? ttsModelId : providerDef?.defaultModelId;

        return generateTTS(
          {
            providerId: providerId as TTSProviderId,
            modelId: modelForCall,
            voice: voiceForCall,
            speed: ttsSpeed ?? 1.0,
            apiKey,
            baseUrl,
          },
          text,
        );
      },
      { category: 'tts' },
    );

    const { audio, format, usedProviderId, usedVoice } = result;
    if (chainProviderId !== primaryProviderId) {
      log.warn(`TTS fell back from ${primaryProviderId} to ${chainProviderId}`);
    }

    // Convert to base64
    const base64 = Buffer.from(audio).toString('base64');

    // When stageId is provided, also upload to Supabase Storage so the audio URL
    // is persisted and accessible from other devices without local IndexedDB.
    let audioUrl: string | undefined;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (stageId && supabaseUrl && supabaseServiceKey) {
      try {
        const supabase = createAdminClient();
        const mimeType = format === 'mp3' ? 'audio/mpeg' : `audio/${format}`;
        const storagePath = `${stageId}/audio/${audioId}.${format}`;
        const { error } = await supabase.storage.from('courses').upload(storagePath, audio, {
          contentType: mimeType,
          upsert: true,
        });
        if (!error) {
          audioUrl = `${supabaseUrl}/storage/v1/object/public/courses/${storagePath}`;
          log.info(`TTS uploaded to Supabase: ${storagePath} (${audio.length} bytes)`);
        } else {
          log.warn(`TTS Supabase upload failed for ${audioId}:`, error.message);
        }
      } catch (uploadErr) {
        log.warn(`TTS Supabase upload error for ${audioId}:`, uploadErr);
      }
    }

    return apiSuccess({ audioId, base64, format, audioUrl, ttsProviderId: usedProviderId, ttsVoice: usedVoice });
  } catch (error) {
    log.error(
      `TTS generation failed [provider=${ttsProviderId ?? 'unknown'}, voice=${ttsVoice ?? 'unknown'}, audioId=${audioId ?? 'unknown'}]:`,
      error,
    );
    return apiError(
      'GENERATION_FAILED',
      500,
      error instanceof Error ? error.message : String(error),
    );
  }
}
