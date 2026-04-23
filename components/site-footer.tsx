export function SiteFooter() {
  return (
    <footer className="relative z-10 mt-24 border-t border-bone-200/[0.08] bg-ink-950">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-6 px-6 py-10 font-mono text-[10px] uppercase tracking-[0.18em] text-bone-500 md:flex-row md:items-center md:justify-between md:px-10">
        <div className="flex flex-col gap-1.5">
          <span>
            Derby/1M · Open source —{' '}
            <a
              href="https://github.com/"
              className="text-bone-400 underline-offset-4 transition hover:text-bone-200 hover:underline"
            >
              github
            </a>
          </span>
          <span className="text-bone-600">
            Not affiliated with Churchill Downs. No wagering. Display only.
          </span>
        </div>
        <div className="flex flex-col gap-1.5 md:items-end">
          <span>
            Problem gambling?{' '}
            <span className="text-bone-400">1-800-GAMBLER</span> · 21+
          </span>
          <span className="text-bone-600">
            2026 Kentucky Derby — 2026-05-02
          </span>
        </div>
      </div>
    </footer>
  );
}
