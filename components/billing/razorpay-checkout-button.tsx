'use client';

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import posthog from 'posthog-js';
import type { RazorpayPlanId } from '@/lib/razorpay/client';

declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  order_id: string;
  name: string;
  description: string;
  prefill?: { email?: string; name?: string };
  theme?: { color?: string };
  handler: (response: RazorpaySuccessResponse) => void;
  modal?: {
    ondismiss?: () => void;
  };
}

interface RazorpaySuccessResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

interface RazorpayInstance {
  open: () => void;
  on: (event: string, handler: (response: { error: { description: string } }) => void) => void;
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window !== 'undefined' && window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

interface RazorpayCheckoutButtonProps {
  period: RazorpayPlanId;
  label?: string;
  className?: string;
  disabled?: boolean;
  userEmail?: string;
  userName?: string;
  onSuccess?: (period: RazorpayPlanId) => void;
  children?: React.ReactNode;
}

export function RazorpayCheckoutButton({
  period,
  label,
  className,
  disabled,
  userEmail,
  userName,
  onSuccess,
  children,
}: RazorpayCheckoutButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleCheckout = useCallback(async () => {
    setLoading(true);
    posthog.capture('razorpay_checkout_initiated', { plan_period: period });

    try {
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        toast.error('Failed to load payment gateway. Please try again.');
        return;
      }

      const res = await fetch('/api/razorpay/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ period }),
      });
      const orderData = await res.json();

      if (!res.ok) {
        throw new Error(orderData.error || 'Failed to create order');
      }

      const rzp = new window.Razorpay({
        key: orderData.key_id,
        amount: orderData.amount,
        currency: orderData.currency,
        order_id: orderData.order_id,
        name: 'Slate',
        description: `Slate ${period.replace(/_/g, ' ')} plan`,
        prefill: { email: userEmail, name: userName },
        theme: { color: '#073b4c' },
        handler: async (response: RazorpaySuccessResponse) => {
          try {
            const verifyRes = await fetch('/api/razorpay/verify-payment', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ...response, period }),
            });
            const verifyData = await verifyRes.json();

            if (!verifyRes.ok) {
              throw new Error(verifyData.error || 'Payment verification failed');
            }

            toast.success(
              verifyData.type === 'topup'
                ? '10 courses added to your account! Happy learning 🎉'
                : 'Payment successful! Your plan has been activated.',
            );
            onSuccess?.(period);
          } catch (err: any) {
            toast.error(err.message || 'Payment verification failed');
          }
        },
        modal: {
          ondismiss: () => {
            toast.info('Payment cancelled — no charge was made.');
            setLoading(false);
          },
        },
      });

      rzp.on('payment.failed', (response: { error: { description: string } }) => {
        toast.error(response.error.description || 'Payment failed');
        setLoading(false);
      });

      rzp.open();
      // loading stays true until modal dismisses or payment completes
    } catch (err: any) {
      toast.error(err.message || 'Something went wrong');
      setLoading(false);
    }
  }, [period, userEmail, userName, onSuccess]);

  return (
    <Button
      onClick={handleCheckout}
      disabled={disabled || loading}
      className={className}
    >
      {loading ? 'Processing…' : (children ?? label ?? 'Pay with Razorpay')}
    </Button>
  );
}
