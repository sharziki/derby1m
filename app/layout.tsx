import type { Metadata } from 'next';
import { Cormorant_Garamond, Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';

const display = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  style: ['normal', 'italic'],
  variable: '--font-display',
  display: 'swap',
});

const sans = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-sans',
  display: 'swap',
});

const mono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://derby1m.com'),
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
    url: 'https://derby1m.com',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Derby/1M',
    description: 'One million simulated Kentucky Derbies.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body className="min-h-screen bg-ink-950 text-bone-200 antialiased">
        <SiteHeader />
        <main className="relative z-10">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
