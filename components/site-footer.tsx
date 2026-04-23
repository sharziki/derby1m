import { loadField } from '@/lib/field';

export async function SiteFooter() {
  let updated: string | null = null;
  let raceLabel = '2026 Kentucky Derby — May 2, 2026';
  try {
    const field = await loadField();
    updated = field.meta.updated ?? null;
    if (field.meta.race) raceLabel = `${field.meta.race} — ${field.meta.date}`;
  } catch {
    // Footer must render even if data is missing.
  }

  return (
    <footer className="mt-24 border-t border-paper-200 bg-paper-50">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-5 px-5 py-10 md:flex-row md:items-center md:justify-between md:px-8">
        <div className="flex flex-col gap-1.5">
          <span className="font-display text-[20px] italic leading-none text-ink-900">
            Derby<span className="text-rose-deep">/1M</span>
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">
            Monte Carlo · Display only · Not affiliated with Churchill Downs
          </span>
        </div>
        <div className="flex flex-col gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500 md:items-end">
          <span>{raceLabel}</span>
          {updated && (
            <span className="text-ink-400">Data last updated {updated}</span>
          )}
        </div>
      </div>
    </footer>
  );
}
