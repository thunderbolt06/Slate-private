import { registerOTel } from '@vercel/otel';
import * as Sentry from '@sentry/nextjs';
import { PostHogSpanProcessor } from '@posthog/ai/otel';

export async function register() {
  registerOTel({
    serviceName: process.env.OTEL_SERVICE_NAME || 'openmaic',
    spanProcessors: [
      new PostHogSpanProcessor({
        apiKey: process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN!,
        host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
      }),
    ],
  });

  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

export const onRequestError = Sentry.captureRequestError;
