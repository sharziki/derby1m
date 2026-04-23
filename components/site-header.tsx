import Link from 'next/link';

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-paper-200 bg-paper-50/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1200px] items-center justify-between px-5 py-4 md:px-8 md:py-5">
        <Link
          href="/"
          aria-label="Derby/1M home"
          className="group inline-flex items-baseline gap-1"
        >
          <span className="font-display text-[26px] italic leading-none text-ink-900 transition group-hover:text-rose-deep">
            Derby<span className="text-rose-deep">/1M</span>
          </span>
        </Link>

        <nav className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-500 sm:gap-5 sm:text-[11px] md:gap-6">
          <Link href="/" className="transition hover:text-rose-deep">
            <span className="hidden sm:inline">Simulator</span>
            <span className="sm:hidden">Sim</span>
          </Link>
          <Link href="/methodology" className="transition hover:text-rose-deep">
            <span className="hidden sm:inline">Methodology</span>
            <span className="sm:hidden">Method</span>
          </Link>
          <Link href="/consensus" className="transition hover:text-rose-deep">
            <span className="hidden sm:inline">Consensus</span>
            <span className="sm:hidden">Cons</span>
          </Link>
          <Link href="/scorecard" className="transition hover:text-rose-deep">
            <span className="hidden sm:inline">Scorecard</span>
            <span className="sm:hidden">Score</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
