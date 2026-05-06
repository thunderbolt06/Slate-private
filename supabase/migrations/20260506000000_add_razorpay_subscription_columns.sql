-- =============================================================================
-- Add Razorpay subscription columns to user_plans
-- Mirrors the existing Stripe columns. Razorpay does not use a separate
-- "customer" object the same way Stripe does, but we keep razorpay_customer_id
-- around for future use (e.g. saving cards via Customer API).
-- =============================================================================

ALTER TABLE public.user_plans
  ADD COLUMN IF NOT EXISTS razorpay_customer_id     text,
  ADD COLUMN IF NOT EXISTS razorpay_subscription_id text,
  ADD COLUMN IF NOT EXISTS razorpay_plan_id         text,
  ADD COLUMN IF NOT EXISTS trial_ends_at            timestamptz;

CREATE INDEX IF NOT EXISTS idx_user_plans_razorpay_sub_id
  ON public.user_plans (razorpay_subscription_id);

CREATE INDEX IF NOT EXISTS idx_user_plans_razorpay_customer_id
  ON public.user_plans (razorpay_customer_id);

-- Allow 'trialing' as a recognised subscription_status value (Razorpay returns
-- 'authenticated' on mandate setup; we map it to 'trialing' until start_at).
-- subscription_status is a free-form text column so no enum change required.
