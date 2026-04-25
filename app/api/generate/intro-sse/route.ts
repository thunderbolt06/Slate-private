import { NextRequest } from 'next/server';
import { generateIntroScript } from '@/lib/generation/intro-streaming';
import { generateTTS } from '@/lib/audio/tts-providers';
import { resolveTTSApiKey, resolveTTSBaseUrl } from '@/lib/server/provider-config';
import { createLogger } from '@/lib/logger';
import { resolveGenerationLanguage } from '@/lib/constants/generation';
import { DEFAULT_TTS_VOICES } from '@/lib/audio/constants';
import { splitLongSpeechTextByBytes, GEMINI_TTS_MAX_BYTES, concatWavBuffers } from '@/lib/audio/tts-utils';
import type { TTSProviderId } from '@/lib/audio/types';

const log = createLogger('IntroSSE');

export const maxDuration = 300;

const DEFAULT_PROVIDER: TTSProviderId = 'gemini-tts';

/**
 * SSE Endpoint for prioritized course introduction.
 * Sends: script → audio_ready (complete base64 audio + format) → done
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { stageId, name, description, language, voiceId: requestedVoiceId } = body;

  if (!name || !stageId) {
    return new Response('Missing name or stageId', { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      try {
        log.info(`Starting intro generation for: ${name} (${stageId})`);

        const script = await generateIntroScript({
          courseName: name,
          courseDescription: description,
          language: resolveGenerationLanguage(language),
        });

        sendEvent('script', { text: script });

        const voiceId = requestedVoiceId || DEFAULT_TTS_VOICES[DEFAULT_PROVIDER];
        const apiKey = resolveTTSApiKey(DEFAULT_PROVIDER);
        const baseUrl = resolveTTSBaseUrl(DEFAULT_PROVIDER);
        const ttsConfig = { providerId: DEFAULT_PROVIDER, voice: voiceId, apiKey, baseUrl };

        // Gemini TTS has a 512-byte input limit per call — split at sentence
        // boundaries then concatenate the WAV chunks into a single buffer.
        const chunks = splitLongSpeechTextByBytes(script, GEMINI_TTS_MAX_BYTES);
        log.info(`Intro TTS: ${chunks.length} chunk(s) for ${script.length} chars`);

        const audioChunks: Uint8Array[] = [];
        let format = 'wav';
        for (const chunk of chunks) {
          const result = await generateTTS(ttsConfig, chunk);
          audioChunks.push(result.audio);
          format = result.format;
        }

        const audio = format === 'wav' && audioChunks.length > 1
          ? concatWavBuffers(audioChunks)
          : audioChunks.reduce((acc, c) => {
              const merged = new Uint8Array(acc.length + c.length);
              merged.set(acc); merged.set(c, acc.length);
              return merged;
            });

        const base64 = Buffer.from(audio).toString('base64');
        sendEvent('audio_ready', { audio: base64, format });

        sendEvent('done', { success: true });
        log.info(`Intro generation completed for: ${stageId}`);
      } catch (error) {
        log.error('Intro SSE failed:', error);
        sendEvent('error', { message: error instanceof Error ? error.message : 'Unknown error' });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
