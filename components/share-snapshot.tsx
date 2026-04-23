import { Silk } from '@/components/silk';
import { pct } from '@/lib/utils';
import type { Horse, HorseResult, Scenario } from '@/lib/types';

/**
 * Off-screen 1080×1080 layout captured by html-to-image for the share PNG.
 * Light editorial palette so it reads like a printed page in any feed.
 */
export function ShareSnapshot({
  field,
  results,
  scenario,
}: {
  field: Horse[];
  results: HorseResult[];
  scenario: Scenario;
}) {
  const horsesById = new Map(field.map((h) => [h.id, h]));
  const rows = [...results].sort((a, b) => b.p_win - a.p_win);
  const scenarioText = scenarioSummary(scenario);

  return (
    <div
      style={{ width: 1080, height: 1080, background: '#FAF7F2' }}
      className="relative flex flex-col p-14 font-serif text-ink-900"
    >
      {/* Header */}
      <header className="flex items-start justify-between border-b border-paper-200 pb-6">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-[14px] uppercase tracking-[0.32em] text-ink-500">
            Derby
          </span>
          <span className="font-display text-[56px] italic leading-none text-ink-900">
            /1M
          </span>
        </div>
        <div className="text-right">
          <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-500">
            152nd Kentucky Derby
          </div>
          <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-500">
            May 2, 2026 · 1¼ miles
          </div>
        </div>
      </header>

      {/* Subtitle */}
      <div className="mt-6 flex items-center justify-between font-mono text-[12px] uppercase tracking-[0.18em]">
        <span className="text-ink-700">{scenarioText}</span>
        <span className="text-rose-deep">1,000,000 simulations</span>
      </div>

      {/* Rows */}
      <ol className="mt-6 flex-1">
        {rows.map((r) => {
          const horse = horsesById.get(r.id);
          if (!horse) return null;
          return (
            <li
              key={r.id}
              className="grid grid-cols-[36px_24px_minmax(0,1fr)_84px_minmax(0,3fr)] items-center gap-4 border-b border-paper-200 py-[14px]"
            >
              <span className="text-right font-mono text-[13px] tabular-nums text-ink-500">
                {r.post_position.toString().padStart(2, '0')}
              </span>
              <Silk silk={horse.silk} size={20} />
              <span className="flex items-baseline gap-2 truncate">
                <span className="font-display text-[24px] italic leading-none text-ink-900">
                  {r.name}
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.10em] text-ink-500">
                  {horse.running_style}
                </span>
              </span>
              <span className="text-right font-mono text-[16px] font-medium tabular-nums text-rose-deep">
                {pct(r.p_win, 1)}
              </span>
              <div className="relative flex h-[24px] overflow-hidden rounded-[2px] bg-paper-200">
                {r.finish_histogram.map((p, k) => (
                  <span
                    key={k}
                    style={{
                      width: `${p * 100}%`,
                      background: shareColor(k, r.finish_histogram.length),
                      borderRight:
                        k < r.finish_histogram.length - 1 && p > 0.001
                          ? '1px solid rgba(255,255,255,0.55)'
                          : 'none',
                    }}
                    className="h-full"
                  />
                ))}
              </div>
            </li>
          );
        })}
      </ol>

      {/* Footer */}
      <footer className="mt-4 flex items-end justify-between border-t border-paper-200 pt-4 font-mono text-[11px] uppercase tracking-[0.22em]">
        <span className="text-ink-700">derby1m.vercel.app</span>
        <span className="text-ink-500">
          Monte Carlo · Open source · Not a wagering product
        </span>
      </footer>
    </div>
  );
}

function shareColor(k: number, n: number): string {
  if (k === 0) return '#8B1A2B';
  if (k === 1) return '#B83A4E';
  if (k === 2) return '#D2737E';
  if (k === 3) return '#E8BCC4';
  const t = (k - 3) / Math.max(n - 4, 1);
  const alpha = Math.max(0.06, 0.22 * (1 - t));
  return `rgba(122, 117, 108, ${alpha.toFixed(3)})`;
}

function scenarioSummary(s: Scenario): string {
  const track = s.track.charAt(0).toUpperCase() + s.track.slice(1);
  const pace = s.pace.charAt(0).toUpperCase() + s.pace.slice(1);
  const beliefCount = Object.values(s.beliefs).filter((v) => v !== 0).length;
  const beliefPart = beliefCount
    ? ` · ${beliefCount} belief override${beliefCount === 1 ? '' : 's'}`
    : '';
  return `${track} track · ${pace} pace${beliefPart}`;
}
