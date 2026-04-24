import { registerOTel } from '@vercel/otel';
import * as Sentry from '@sentry/nextjs';

export async function register() {
  const posthogApiKey = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  const spanProcessors = [];

  if (posthogApiKey) {
    const { PostHogSpanProcessor } = await import('@posthog/ai/otel');
    spanProcessors.push(
      new PostHogSpanProcessor({
        apiKey: posthogApiKey,
        host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
      })
    );
  }

  registerOTel({
    serviceName: process.env.OTEL_SERVICE_NAME || 'openmaic',
    spanProcessors,
  });

  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

export const onRequestError = Sentry.captureRequestError;
