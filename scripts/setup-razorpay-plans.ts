/**
 * One-time script to create the Slate Plus monthly + yearly plans on Razorpay.
 *
 * Usage:
 *   1. Make sure RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are set in your .env
 *   2. Run: pnpm tsx scripts/setup-razorpay-plans.ts
 *   3. Copy the printed plan IDs into RAZORPAY_PLAN_MONTHLY_ID /
 *      RAZORPAY_PLAN_YEARLY_ID in your .env
 *
 * Idempotent: existing plans (by name) are skipped, not duplicated.
 *
 * Plans are immutable on Razorpay once created. To change pricing, create a
 * new plan and switch the env var to point at it.
 */

import 'dotenv/config';
import Razorpay from 'razorpay';
import { RAZORPAY_SUBSCRIPTION_PLANS } from '../lib/razorpay/client';

async function main() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    console.error('RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be set in your env');
    process.exit(1);
  }

  const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });

  console.log(`Using Razorpay key: ${keyId} (${keyId.startsWith('rzp_live_') ? 'LIVE' : 'TEST'})`);
  console.log('');

  for (const [period, cfg] of Object.entries(RAZORPAY_SUBSCRIPTION_PLANS)) {
    console.log(`── ${period} ─────────────────────────────`);
    console.log(`name:     ${cfg.name}`);
    console.log(`amount:   ${cfg.amount} paise (₹${cfg.amount / 100})`);
    console.log(`period:   ${cfg.period}, interval: ${cfg.interval}`);

    const existingId = process.env[cfg.envKey];
    if (existingId) {
      console.log(`SKIP - ${cfg.envKey} already set to ${existingId}`);
      console.log('');
      continue;
    }

    const plan = await razorpay.plans.create({
      period: cfg.period,
      interval: cfg.interval,
      item: {
        name: cfg.name,
        amount: cfg.amount,
        currency: cfg.currency,
        description: cfg.name,
      },
      notes: {
        slate_period: period,
      },
    });

    console.log(`CREATED plan_id: ${plan.id}`);
    console.log(`Add to .env:     ${cfg.envKey}=${plan.id}`);
    console.log('');
  }

  console.log('Done. Add the plan IDs to your .env, redeploy, and you can subscribe.');
}

main().catch((err) => {
  console.error('Failed to create plans:', err);
  process.exit(1);
});
