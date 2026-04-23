import Link from 'next/link';
import { Horseshoe } from '@/components/graphics';

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-paper-200 bg-paper-50/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1200px] items-center justify-between px-5 py-4 md:px-8 md:py-5">
        <Link
          href="/"
          aria-label="Derby/1M home"
          className="group flex items-center gap-2.5"
        >
          <Horseshoe size={18} className="transition group-hover:scale-110" />
          <span className="flex items-baseline gap-2">
            <span className="font-mono text-[11px] uppercase tracking-[0.28em] text-ink-500 transition group-hover:text-ink-800">
              Derby
            </span>
            <span className="font-display text-[26px] italic leading-none text-ink-900">
              /1M
            </span>
          </span>
        </Link>

        <nav className="flex items-center gap-5 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-500 md:gap-7">
          <Link href="/" className="transition hover:text-rose-deep">
            Simulator
          </Link>
          <Link href="/methodology" className="transition hover:text-rose-deep">
            Methodology
          </Link>
          <Link href="/scorecard" className="transition hover:text-rose-deep">
            Scorecard
          </Link>
        </nav>
      </div>
    </header>
  );
}
