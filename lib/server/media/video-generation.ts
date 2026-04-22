import 'server-only';

import type { VideoGenerationConfig, VideoGenerationOptions, VideoGenerationResult } from '@/lib/media/types';
import { createLogger } from '@/lib/logger';
import { normalizeVideoOptions } from '@/lib/media/video-providers';
import { generateWithSeedance, testSeedanceConnectivity } from '@/lib/media/adapters/seedance-adapter';
import { generateWithKling, testKlingConnectivity } from '@/lib/media/adapters/kling-adapter';
import { generateWithVeo, testVeoConnectivity } from '@/lib/media/adapters/veo-adapter';
import {
  generateWithMiniMaxVideo,
  testMiniMaxVideoConnectivity,
} from '@/lib/media/adapters/minimax-video-adapter';
import { generateWithGrokVideo, testGrokVideoConnectivity } from '@/lib/media/adapters/grok-video-adapter';

const log = createLogger('VideoGen');

export async function testVideoConnectivity(
  config: VideoGenerationConfig,
): Promise<{ success: boolean; message: string }> {
  switch (config.providerId) {
    case 'seedance':
      return testSeedanceConnectivity(config);
    case 'kling':
      return testKlingConnectivity(config);
    case 'veo':
      return testVeoConnectivity(config);
    case 'minimax-video':
      return testMiniMaxVideoConnectivity(config);
    case 'grok-video':
      return testGrokVideoConnectivity(config);
    default:
      return {
        success: false,
        message: `Unsupported video provider: ${config.providerId}`,
      };
  }
}

export async function generateVideo(
  config: VideoGenerationConfig,
  options: VideoGenerationOptions,
): Promise<VideoGenerationResult> {
  const normalizedOptions = normalizeVideoOptions(config.providerId, options);

  log.info('[TOKEN_USAGE] video-generation', {
    service: 'video',
    provider: config.providerId,
    durationMs: normalizedOptions.duration ? normalizedOptions.duration * 1000 : 0,
    usage: 1,
  });

  switch (config.providerId) {
    case 'seedance':
      return generateWithSeedance(config, normalizedOptions);
    case 'kling':
      return generateWithKling(config, normalizedOptions);
    case 'veo':
      return generateWithVeo(config, normalizedOptions);
    case 'minimax-video':
      return generateWithMiniMaxVideo(config, normalizedOptions);
    case 'grok-video':
      return generateWithGrokVideo(config, normalizedOptions);
    default:
      throw new Error(`Unsupported video provider: ${config.providerId}`);
  }
}

