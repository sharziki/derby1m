import type { Metadata, Viewport } from 'next';
import { Newsreader, Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';

const display = Newsreader({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-display',
  display: 'swap',
});

const serif = Newsreader({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-serif',
  display: 'swap',
});

const sans = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-sans',
  display: 'swap',
});

const mono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
});

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : 'https://derby1m.vercel.app');

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Derby/1M — Kentucky Derby Monte Carlo',
    template: '%s · Derby/1M',
  },
  description:
    'One million simulated Kentucky Derbies. Adjust track, pace, and per-horse beliefs. Watch the probability distribution update live.',
  openGraph: {
    title: 'Derby/1M — Kentucky Derby Monte Carlo',
    description:
      'One million simulated Kentucky Derbies. Live probability distributions for the 2026 field.',
    type: 'website',
    url: SITE_URL,
    siteName: 'Derby/1M',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Derby/1M — Kentucky Derby Monte Carlo',
    description: 'One million simulated Kentucky Derbies — 2026 field.',
  },
};

export const viewport: Viewport = {
  themeColor: '#FAF7F2',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${serif.variable} ${sans.variable} ${mono.variable}`}
    >
      <body className="min-h-screen bg-paper-50 text-ink-900 antialiased">
        <SiteHeader />
        <main className="relative">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
