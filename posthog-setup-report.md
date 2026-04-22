<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics and LLM analytics into the Slate Up Next.js App Router project. The integration covers client-side initialization (via `instrumentation-client.ts` using the Next.js 15.3+ pattern), a server-side PostHog Node.js client (`lib/posthog-server.ts`), a reverse proxy configured in `next.config.ts` (routing `/ingest/*` through the Next.js server to avoid ad-blockers), event tracking across all key user journeys including authentication, course generation, payments, quiz grading, and feedback, and full LLM analytics via the Vercel AI SDK + OpenTelemetry integration.

## Events instrumented

| Event | Description | File |
|---|---|---|
| `user_signed_in` | User successfully signed in with email/password or Google OAuth | `app/auth/login/page.tsx` |
| `user_signed_up` | User successfully created a new account with email/password | `app/auth/login/page.tsx` |
| `classroom_generation_started` | User submitted a prompt to generate a new AI classroom from the home page | `app/page.tsx` |
| `checkout_initiated` | User clicked a pricing plan button to start the Stripe checkout flow | `app/pricing/pricing-client.tsx` |
| `subscription_management_opened` | User clicked to manage their existing subscription via Stripe portal | `app/pricing/pricing-client.tsx` |
| `checkout_session_created` | Server successfully created a Stripe checkout session for a plan upgrade | `app/api/stripe/checkout/route.ts` |
| `subscription_activated` | Stripe webhook confirmed a subscription or lifetime payment was completed | `app/api/stripe/webhook/route.ts` |
| `subscription_cancelled` | Stripe webhook confirmed the user's subscription was deleted and plan downgraded to FREE | `app/api/stripe/webhook/route.ts` |
| `topup_completed` | Stripe webhook confirmed a course credit top-up purchase | `app/api/stripe/webhook/route.ts` |
| `classroom_generation_queued` | Server successfully queued a classroom generation Temporal workflow job | `app/api/generate-classroom/route.ts` |
| `quiz_graded` | Server graded a student's quiz answer using the LLM | `app/api/quiz-grade/route.ts` |
| `feedback_submitted` | User successfully submitted a feedback form | `app/api/feedback/route.ts` |

## Files created or modified

- **`instrumentation-client.ts`** — PostHog `posthog-js` initialization appended alongside existing Sentry init
- **`lib/posthog-server.ts`** — New server-side PostHog Node.js client singleton
- **`next.config.ts`** — Added `/ingest/*` reverse proxy rewrites + `skipTrailingSlashRedirect: true`
- **`.env.local`** — `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` and `NEXT_PUBLIC_POSTHOG_HOST` set

## LLM analytics integration

PostHog LLM analytics are instrumented via the **Vercel AI SDK + OpenTelemetry** path using `@posthog/ai`.

### How it works

Every `generateText` / `streamText` call in the app flows through the central `callLLM` / `streamLLM` wrappers in `lib/ai/llm.ts`. The integration adds two things:

1. **`instrumentation.ts`** — `PostHogSpanProcessor` registered as an OpenTelemetry span processor via `@vercel/otel`'s `registerOTel`. It receives `gen_ai.*` OTEL spans and forwards them to PostHog as `$ai_generation` events automatically.

2. **`lib/ai/llm.ts`** — `injectTelemetry` helper injects `experimental_telemetry: { isEnabled: true, functionId: source }` into every Vercel AI SDK call, enabling span emission. The `functionId` maps to the `source` label (e.g. `quiz-grade`, `scene-stream`) so calls are distinguishable in PostHog traces.

### LLM properties captured per generation

| Property | Description |
|---|---|
| `$ai_model` | Model used (e.g. `claude-sonnet-4-6`, `gpt-4o`) |
| `$ai_provider` | Provider (anthropic, openai, google, etc.) |
| `$ai_input_tokens` | Prompt token count |
| `$ai_output_tokens` | Completion token count |
| `$ai_total_cost_usd` | Estimated cost in USD (auto-calculated from model pricing) |
| `$ai_latency` | Call duration in seconds |
| `$ai_trace_name` | Function ID / source label (e.g. `quiz-grade`) |
| `$ai_error` | Error message if the call failed |

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- **Dashboard — Analytics basics**: https://eu.posthog.com/project/164193/dashboard/636713
- **Signup & Login Trend**: https://eu.posthog.com/project/164193/insights/ey0KlfjS
- **Checkout Conversion Funnel** (generation → checkout → activation): https://eu.posthog.com/project/164193/insights/f7Abhh7U
- **Classroom Generations per Day**: https://eu.posthog.com/project/164193/insights/6uXq85uP
- **Subscription Activations vs Cancellations** (churn signal): https://eu.posthog.com/project/164193/insights/sLYgbDFc
- **Plan Period Breakdown at Checkout** (monthly vs yearly vs lifetime): https://eu.posthog.com/project/164193/insights/4YTMM7U3

### LLM Analytics dashboard

- **Dashboard — LLM Analytics**: https://eu.posthog.com/project/164193/dashboard/636719
- **Total LLM Cost per Day (USD)**: https://eu.posthog.com/project/164193/insights/BhIahHsY
- **LLM Generations by Model**: https://eu.posthog.com/project/164193/insights/bDZiGGrV
- **Average LLM Latency by Function**: https://eu.posthog.com/project/164193/insights/Q8UQ8tJM
- **Token Usage Trend (Input vs Output)**: https://eu.posthog.com/project/164193/insights/AqlV8uVG
- **LLM Error Rate**: https://eu.posthog.com/project/164193/insights/CUFJPmNc

You can also explore individual LLM traces at: https://eu.posthog.com/project/164193/llm-analytics/traces

### Agent skill

We've left an agent skill folder in your project. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
