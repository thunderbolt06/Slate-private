/**
 * Image Generation Service -- routes to provider adapters
 */

import type {
  ImageProviderId,
  ImageGenerationConfig,
  ImageGenerationOptions,
  ImageGenerationResult,
  ImageProviderConfig,
} from './types';
import { createLogger } from '@/lib/logger';

const log = createLogger('ImageGen');
import { generateWithSeedream, testSeedreamConnectivity } from './adapters/seedream-adapter';
import { generateWithQwenImage, testQwenImageConnectivity } from './adapters/qwen-image-adapter';
import { generateWithNanoBanana, testNanoBananaConnectivity } from './adapters/nano-banana-adapter';
import {
  generateWithMiniMaxImage,
  testMiniMaxImageConnectivity,
} from './adapters/minimax-image-adapter';
import { generateWithGrokImage, testGrokImageConnectivity } from './adapters/grok-image-adapter';

export const IMAGE_PROVIDERS: Record<ImageProviderId, ImageProviderConfig> = {
  seedream: {
    id: 'seedream',
    name: 'Seedream',
    requiresApiKey: true,
    defaultBaseUrl: 'https://ark.cn-beijing.volces.com',
    models: [
      { id: 'doubao-seedream-5-0-260128', name: 'Seedream 5.0 Lite' },
      { id: 'doubao-seedream-4-5-251128', name: 'Seedream 4.5' },
      { id: 'doubao-seedream-4-0-250828', name: 'Seedream 4.0' },
      { id: 'doubao-seedream-3-0-t2i-250415', name: 'Seedream 3.0' },
    ],
    supportedAspectRatios: ['16:9', '4:3', '1:1', '9:16'],
  },
  'qwen-image': {
    id: 'qwen-image',
    name: 'Qwen Image',
    requiresApiKey: true,
    defaultBaseUrl: 'https://dashscope.aliyuncs.com',
    models: [
      { id: 'qwen-image-max', name: 'Qwen Image Max' },
      { id: 'qwen-image-max-2025-12-30', name: 'Qwen Image Max (2025-12-30)' },
      { id: 'qwen-image-plus', name: 'Qwen Image Plus' },
      {
        id: 'qwen-image-plus-2026-01-09',
        name: 'Qwen Image Plus (2026-01-09)',
      },
      { id: 'qwen-image', name: 'Qwen Image' },
      { id: 'z-image-turbo', name: 'Z-Image Turbo' },
    ],
    supportedAspectRatios: ['16:9', '4:3', '1:1', '9:16'],
  },
  'nano-banana': {
    id: 'nano-banana',
    name: 'Nano Banana (Gemini)',
    requiresApiKey: true,
    defaultBaseUrl: 'https://generativelanguage.googleapis.com',
    models: [
      {
        id: 'gemini-3.1-flash-image-preview',
        name: 'Gemini 3.1 Flash Image (Nano Banana 2)',
      },
      {
        id: 'gemini-3-pro-image-preview',
        name: 'Gemini 3 Pro Image (Nano Banana Pro)',
      },
      {
        id: 'gemini-2.5-flash-image',
        name: 'Gemini 2.5 Flash Image (Nano Banana)',
      },
    ],
    supportedAspectRatios: ['16:9', '4:3', '1:1'],
  },
  'minimax-image': {
    id: 'minimax-image',
    name: 'MiniMax Image',
    requiresApiKey: true,
    defaultBaseUrl: 'https://api.minimaxi.com',
    models: [
      { id: 'image-01', name: 'Image 01' },
      { id: 'image-01-live', name: 'Image 01 Live' },
    ],
    supportedAspectRatios: ['16:9', '4:3', '1:1', '9:16'],
  },
  'grok-image': {
    id: 'grok-image',
    name: 'Grok Image (xAI)',
    requiresApiKey: true,
    defaultBaseUrl: 'https://api.x.ai/v1',
    models: [
      { id: 'grok-imagine-image', name: 'Grok Imagine Image' },
      { id: 'grok-imagine-image-pro', name: 'Grok Imagine Image Pro' },
    ],
    supportedAspectRatios: ['16:9', '4:3', '1:1', '9:16'],
  },
};

export async function testImageConnectivity(
  config: ImageGenerationConfig,
): Promise<{ success: boolean; message: string }> {
  switch (config.providerId) {
    case 'seedream':
      return testSeedreamConnectivity(config);
    case 'qwen-image':
      return testQwenImageConnectivity(config);
    case 'nano-banana':
      return testNanoBananaConnectivity(config);
    case 'minimax-image':
      return testMiniMaxImageConnectivity(config);
    case 'grok-image':
      return testGrokImageConnectivity(config);
    default:
      return {
        success: false,
        message: `Unsupported image provider: ${config.providerId}`,
      };
  }
}

/**
 * Defensive prompt cleanup for AI image generation.
 *
 * Audit (NEW-002) caught generated slides shipping stock-template imagery with
 * literal placeholder text like `[YOUR NAME/COMPANY], (e.g., QUANTUM TECH)`.
 * Two failure modes can produce this:
 *   1. The outline LLM, when uncertain what to depict, copies a "fill in your
 *      brand here" pattern from training data into the prompt itself.
 *   2. The image model, when given a vague brand-adjacent prompt, defaults to
 *      a stock template with placeholder fields baked into the visual.
 *
 * We address both: strip explicit placeholder phrases out of the prompt, and
 * append a short directive telling the image model to produce a finished
 * illustration with no placeholder text, brackets, or template fields.
 */
const PLACEHOLDER_PATTERNS: RegExp[] = [
  // Bracketed all-caps placeholders, e.g. [YOUR NAME], [COMPANY NAME], <YOUR LOGO>
  /\[\s*(YOUR|INSERT|COMPANY|BRAND|CLIENT|CUSTOMER|LOGO|PRODUCT|TEAM|TITLE|NAME)[^\]]{0,80}\]/gi,
  /<\s*(YOUR|INSERT|COMPANY|BRAND|CLIENT|CUSTOMER|LOGO|PRODUCT|TEAM|TITLE|NAME)[^>]{0,80}>/gi,
  /\{\{\s*(YOUR|INSERT|COMPANY|BRAND|CLIENT|CUSTOMER|LOGO|PRODUCT|TEAM|TITLE|NAME)[^}]{0,80}\}\}/gi,
  // Parenthetical "(e.g., QUANTUM TECH)" / "(e.g. ACME CO)" style fillers
  /\(\s*e\.g\.,?\s+[A-Z][A-Z0-9 .&'-]{2,40}\)/g,
  // "Lorem ipsum" placeholder copy
  /\blorem\s+ipsum\b[^.]*\./gi,
];

const NO_PLACEHOLDER_DIRECTIVE =
  'Render a finished, polished illustration. Do not include any placeholder ' +
  'text, template fields, square or angle brackets, "lorem ipsum", company ' +
  'name slots, or generic brand/logo placeholders such as "[YOUR NAME]" or ' +
  '"[COMPANY]".';

export function sanitizeImagePrompt(prompt: string): string {
  if (!prompt || typeof prompt !== 'string') return prompt;
  let cleaned = prompt;
  for (const pattern of PLACEHOLDER_PATTERNS) {
    cleaned = cleaned.replace(pattern, '');
  }
  // Collapse the whitespace left behind by stripped patterns.
  cleaned = cleaned.replace(/\s{2,}/g, ' ').trim();
  if (cleaned.length === 0) cleaned = prompt; // fall back if we stripped too much
  // Append the directive once, idempotent (so it doesn't pile up if a prompt
  // is sanitized twice on retry).
  if (!cleaned.toLowerCase().includes('placeholder text')) {
    cleaned = `${cleaned}\n\n${NO_PLACEHOLDER_DIRECTIVE}`;
  }
  return cleaned;
}

export async function generateImage(
  config: ImageGenerationConfig,
  options: ImageGenerationOptions,
): Promise<ImageGenerationResult> {
  log.info('[TOKEN_USAGE] image-generation', {
    service: 'image',
    provider: config.providerId,
    usage: 1,
  });

  const sanitizedOptions: ImageGenerationOptions = {
    ...options,
    prompt: sanitizeImagePrompt(options.prompt),
  };

  switch (config.providerId) {
    case 'seedream':
      return generateWithSeedream(config, sanitizedOptions);
    case 'qwen-image':
      return generateWithQwenImage(config, sanitizedOptions);
    case 'nano-banana':
      return generateWithNanoBanana(config, sanitizedOptions);
    case 'minimax-image':
      return generateWithMiniMaxImage(config, sanitizedOptions);
    case 'grok-image':
      return generateWithGrokImage(config, sanitizedOptions);
    default:
      throw new Error(`Unsupported image provider: ${config.providerId}`);
  }
}

export function aspectRatioToDimensions(
  ratio: string,
  maxWidth = 1024,
): { width: number; height: number } {
  const [w, h] = ratio.split(':').map(Number);
  if (!w || !h) return { width: maxWidth, height: Math.round((maxWidth * 9) / 16) };
  return { width: maxWidth, height: Math.round((maxWidth * h) / w) };
}
