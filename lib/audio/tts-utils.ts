/**
 * Shared TTS utilities used by both client-side and server-side generation.
 */

import type { TTSProviderId } from './types';
import type { Action, SpeechAction } from '@/lib/types/action';
import { createLogger } from '@/lib/logger';

const log = createLogger('TTS');

/** Provider-specific max text length limits. */
export const TTS_MAX_TEXT_LENGTH: Partial<Record<TTSProviderId, number>> = {
  'glm-tts': 1024,
};

/**
 * Split long text into chunks that respect sentence boundaries.
 * Tries splitting at sentence-ending punctuation first, then clause-level
 * punctuation, and finally hard-splits at maxLength as a last resort.
 */
export function splitLongSpeechText(text: string, maxLength: number): string[] {
  const normalized = text.trim();
  if (!normalized || normalized.length <= maxLength) return [normalized];

  const units = normalized
    .split(/(?<=[。！？!?；;：:\n])/u)
    .map((part) => part.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = '';

  const pushChunk = (value: string) => {
    const trimmed = value.trim();
    if (trimmed) chunks.push(trimmed);
  };

  const appendUnit = (unit: string) => {
    if (!current) {
      current = unit;
      return;
    }
    if ((current + unit).length <= maxLength) {
      current += unit;
      return;
    }
    pushChunk(current);
    current = unit;
  };

  const hardSplitUnit = (unit: string) => {
    const parts = unit.split(/(?<=[，,、])/u).filter(Boolean);
    if (parts.length > 1) {
      for (const part of parts) {
        if (part.length <= maxLength) appendUnit(part);
        else hardSplitUnit(part);
      }
      return;
    }

    let start = 0;
    while (start < unit.length) {
      appendUnit(unit.slice(start, start + maxLength));
      start += maxLength;
    }
  };

  for (const unit of units.length > 0 ? units : [normalized]) {
    if (unit.length <= maxLength) appendUnit(unit);
    else hardSplitUnit(unit);
  }

  pushChunk(current);
  return chunks;
}

/**
 * Like splitLongSpeechText but compares UTF-8 byte lengths instead of
 * character lengths. Required for providers (e.g. Gemini TTS) whose API
 * enforces a byte limit - important for CJK text where one char = 3 bytes.
 */
export function splitLongSpeechTextByBytes(text: string, maxBytes: number): string[] {
  const byteLen = (s: string) => Buffer.byteLength(s, 'utf8');
  const normalized = text.trim();
  if (!normalized || byteLen(normalized) <= maxBytes) return [normalized];

  const units = normalized
    .split(/(?<=[。！？!?；;：:\n])/u)
    .map((part) => part.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = '';

  const pushChunk = (value: string) => {
    const trimmed = value.trim();
    if (trimmed) chunks.push(trimmed);
  };

  const appendUnit = (unit: string) => {
    if (!current) { current = unit; return; }
    if (byteLen(current + unit) <= maxBytes) { current += unit; return; }
    pushChunk(current);
    current = unit;
  };

  const hardSplitUnit = (unit: string) => {
    const parts = unit.split(/(?<=[，,、])/u).filter(Boolean);
    if (parts.length > 1) {
      for (const part of parts) {
        if (byteLen(part) <= maxBytes) appendUnit(part);
        else hardSplitUnit(part);
      }
      return;
    }
    // Byte-safe character-level split
    let start = 0;
    while (start < unit.length) {
      let end = start + 1;
      while (end < unit.length && byteLen(unit.slice(start, end + 1)) <= maxBytes) end++;
      appendUnit(unit.slice(start, end));
      start = end;
    }
  };

  for (const unit of units.length > 0 ? units : [normalized]) {
    if (byteLen(unit) <= maxBytes) appendUnit(unit);
    else hardSplitUnit(unit);
  }
  pushChunk(current);
  return chunks;
}

/** Gemini TTS byte limit for a single API call (API enforces 512 bytes). */
export const GEMINI_TTS_MAX_BYTES = 450;

/**
 * Concatenate multiple WAV buffers into a single WAV file by merging their
 * PCM data and rewriting the RIFF/data chunk sizes. All buffers must share
 * the same sample rate, channels, and bit depth (guaranteed when they all
 * come from the same Gemini TTS call).
 */
export function concatWavBuffers(wavBuffers: Uint8Array[]): Uint8Array {
  if (wavBuffers.length === 1) return wavBuffers[0];
  const WAV_HEADER = 44;
  const dataParts = wavBuffers.map((b) => b.slice(WAV_HEADER));
  const totalData = dataParts.reduce((s, d) => s + d.length, 0);
  const out = new Uint8Array(WAV_HEADER + totalData);
  out.set(wavBuffers[0].slice(0, WAV_HEADER)); // copy first header
  const view = new DataView(out.buffer);
  view.setUint32(4, 36 + totalData, true);  // RIFF chunk size
  view.setUint32(40, totalData, true);       // data chunk size
  let offset = WAV_HEADER;
  for (const d of dataParts) { out.set(d, offset); offset += d.length; }
  return out;
}

/**
 * Split long speech actions into multiple shorter actions so each stays
 * within the TTS provider's text length limit. Each sub-action gets its
 * own independent audio file - no byte concatenation needed.
 */
export function splitLongSpeechActions(actions: Action[], providerId: TTSProviderId): Action[] {
  const maxLength = TTS_MAX_TEXT_LENGTH[providerId];
  if (!maxLength) return actions;

  let didSplit = false;
  const nextActions: Action[] = actions.flatMap((action) => {
    if (action.type !== 'speech' || !action.text || action.text.length <= maxLength)
      return [action];

    const chunks = splitLongSpeechText(action.text, maxLength);
    if (chunks.length <= 1) return [action];
    didSplit = true;
    const { audioId: _audioId, ...baseAction } = action as SpeechAction;

    log.info(
      `Split speech for ${providerId}: action=${action.id}, len=${action.text.length}, chunks=${chunks.length}`,
    );
    return chunks.map((chunk, i) => ({
      ...baseAction,
      id: `${action.id}_tts_${i + 1}`,
      text: chunk,
    }));
  });
  return didSplit ? nextActions : actions;
}
