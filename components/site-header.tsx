import Link from 'next/link';

export function SiteHeader() {
  return (
    <header className="relative z-20 border-b border-bone-200/[0.08] bg-ink-950/80 backdrop-blur">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-5 md:px-10">
        <Link href="/" className="group flex items-baseline gap-3">
          <span className="font-mono text-[11px] uppercase tracking-[0.32em] text-bone-500 transition group-hover:text-bone-300">
            Derby
          </span>
          <span className="font-display text-2xl italic leading-none text-bone-100">
            /1M
          </span>
        </Link>

        <nav className="flex items-center gap-7 font-mono text-[11px] uppercase tracking-[0.18em] text-bone-500">
          <Link href="/" className="transition hover:text-bone-200">
            Simulator
          </Link>
          <Link href="/methodology" className="transition hover:text-bone-200">
            Methodology
          </Link>
          <Link href="/scorecard" className="transition hover:text-bone-200">
            Scorecard
          </Link>
        </nav>
      </div>
    </header>
  );
}
