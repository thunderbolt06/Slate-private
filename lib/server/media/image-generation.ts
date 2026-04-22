import 'server-only';

import type { ImageGenerationConfig, ImageGenerationOptions, ImageGenerationResult } from '@/lib/media/types';
import { createLogger } from '@/lib/logger';
import { generateWithSeedream, testSeedreamConnectivity } from '@/lib/media/adapters/seedream-adapter';
import { generateWithQwenImage, testQwenImageConnectivity } from '@/lib/media/adapters/qwen-image-adapter';
import { generateWithNanoBanana, testNanoBananaConnectivity } from '@/lib/media/adapters/nano-banana-adapter';
import {
  generateWithMiniMaxImage,
  testMiniMaxImageConnectivity,
} from '@/lib/media/adapters/minimax-image-adapter';
import { generateWithGrokImage, testGrokImageConnectivity } from '@/lib/media/adapters/grok-image-adapter';

const log = createLogger('ImageGen');

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

export async function generateImage(
  config: ImageGenerationConfig,
  options: ImageGenerationOptions,
): Promise<ImageGenerationResult> {
  log.info('[TOKEN_USAGE] image-generation', {
    service: 'image',
    provider: config.providerId,
    usage: 1,
  });

  switch (config.providerId) {
    case 'seedream':
      return generateWithSeedream(config, options);
    case 'qwen-image':
      return generateWithQwenImage(config, options);
    case 'nano-banana':
      return generateWithNanoBanana(config, options);
    case 'minimax-image':
      return generateWithMiniMaxImage(config, options);
    case 'grok-image':
      return generateWithGrokImage(config, options);
    default:
      throw new Error(`Unsupported image provider: ${config.providerId}`);
  }
}

