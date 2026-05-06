import type { Metadata } from 'next';
import { Nunito, Fredoka } from 'next/font/google';
import './globals.css';
import 'animate.css';
import 'katex/dist/katex.min.css';
import { ThemeProvider } from '@/lib/hooks/use-theme';
import { I18nProvider } from '@/lib/hooks/use-i18n';
import { Toaster } from '@/components/ui/sonner';
import { ServerProvidersInit } from '@/components/server-providers-init';
import { Analytics } from '@vercel/analytics/next';
import { cn } from '@/lib/utils';
import Script from 'next/script';
import { SpeedInsights } from '@vercel/speed-insights/next';
import Clarity from '@microsoft/clarity';

const projectId = "wdjzxzmgvb"

Clarity.init(projectId);

const nunito = Nunito({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const fredoka = Fredoka({
  subsets: ['latin'],
  variable: '--font-fredoka',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: 'Slate',
  description:
    'AI-powered interactive classroom. Learn anything, with anyone, anytime.',
  // app.slateup.ai is the authenticated product surface, not a public marketing
  // surface, so it should not be indexed. Public-facing content lives on
  // www.slateup.ai which is the SEO target.
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn(nunito.variable, fredoka.variable, 'h-full')} suppressHydrationWarning>
      <body
        className={`font-sans antialiased h-full`}
        suppressHydrationWarning
      >
        <Script
          async
          src="https://www.googletagmanager.com/gtag/js?id=G-05Q10VRYSH"
        />
        <Script id="google-analytics">
          {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());

              gtag('config', 'G-05Q10VRYSH');
            `}
        </Script>
        <ThemeProvider>
          <I18nProvider>
            <ServerProvidersInit />
            {children}
            <Toaster position="top-center" />
          </I18nProvider>
        </ThemeProvider>
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
