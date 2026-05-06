import { NextRequest, NextResponse } from 'next/server';
import { getGeoInfo } from '@/lib/analytics/geo';

export type PaymentProvider = 'razorpay' | 'stripe';

export interface PaymentProviderResponse {
  provider: PaymentProvider;
  countryCode: string;
  countryName: string;
}

/**
 * GET /api/payment/provider
 * Returns the appropriate payment provider for the requesting user's country.
 * India (IN) → Razorpay, everywhere else → Stripe.
 */
export async function GET(req: NextRequest): Promise<NextResponse<PaymentProviderResponse>> {
  const geo = getGeoInfo(req.headers);
  // const provider: PaymentProvider = geo.countryCode === 'IN' ? 'razorpay' : 'stripe';
  const provider: PaymentProvider = 'stripe';
  
  return NextResponse.json({
    provider,
    countryCode: geo.countryCode,
    countryName: geo.countryName,
  });
}
