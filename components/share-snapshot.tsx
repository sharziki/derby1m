import { Silk } from '@/components/silk';
import { pct } from '@/lib/utils';
import type { Horse, HorseResult, Scenario } from '@/lib/types';

/**
 * Off-screen 1080×1080 layout captured by html-to-image for the share PNG.
 * Kept visually distinct from the main chart — denser, watermarked, fixed-size.
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
      style={{ width: 1080, height: 1080 }}
      className="relative flex flex-col bg-ink-950 p-14 font-sans text-bone-200"
    >
      {/* Header */}
      <header className="flex items-start justify-between border-b border-bone-200/[0.10] pb-6">
        <div className="flex items-baseline gap-3">
          <span className="font-mono text-[14px] uppercase tracking-[0.32em] text-bone-500">
            Derby
          </span>
          <span className="font-display text-5xl italic leading-none text-bone-100">
            /1M
          </span>
        </div>
        <div className="text-right">
          <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-bone-500">
            152nd Kentucky Derby
          </div>
          <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-bone-500">
            May 2, 2026 · 1¼ miles
          </div>
        </div>
      </header>

      {/* Scenario line */}
      <div className="mt-6 flex items-center justify-between font-mono text-[12px] uppercase tracking-[0.18em] text-bone-400">
        <span>{scenarioText}</span>
        <span className="text-rose-glow">1,000,000 simulations</span>
      </div>

      {/* Rows */}
      <ol className="mt-6 flex-1 overflow-hidden">
        {rows.map((r, i) => {
          const horse = horsesById.get(r.id);
          if (!horse) return null;
          return (
            <li
              key={r.id}
              className="grid grid-cols-[36px_24px_minmax(0,1fr)_80px_minmax(0,3fr)] items-center gap-4 border-b border-bone-200/[0.06] py-3"
            >
              <span className="text-right font-mono text-[13px] tabular-nums text-bone-500">
                {r.post_position.toString().padStart(2, '0')}
              </span>
              <Silk silk={horse.silk} size={20} />
              <span className="flex items-baseline gap-2 truncate">
                <span className="font-display text-[22px] italic leading-none text-bone-100">
                  {r.name}
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-bone-600">
                  {horse.running_style}
                </span>
              </span>
              <span className="text-right font-mono text-[15px] tabular-nums text-rose-glow">
                {pct(r.p_win, 1)}
              </span>
              <div className="relative flex h-[26px] overflow-hidden rounded-[1px] bg-ink-900 ring-1 ring-inset ring-bone-200/[0.06]">
                {r.finish_histogram.map((p, k) => (
                  <span
                    key={k}
                    style={{
                      width: `${p * 100}%`,
                      background: shareColor(k, r.finish_histogram.length),
                      borderRight:
                        k < r.finish_histogram.length - 1 && p > 0.001
                          ? '1px solid rgba(7,9,15,0.55)'
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
      <footer className="mt-4 flex items-end justify-between border-t border-bone-200/[0.10] pt-4 font-mono text-[11px] uppercase tracking-[0.22em] text-bone-500">
        <span>derby1m.com</span>
        <span className="text-bone-600">
          Monte Carlo · open source · not a wagering product
        </span>
      </footer>
    </div>
  );
}

function shareColor(k: number, n: number): string {
  if (k === 0) return 'rgba(180, 52, 45, 0.98)';
  if (k === 1) return 'rgba(180, 52, 45, 0.60)';
  if (k === 2) return 'rgba(180, 52, 45, 0.42)';
  if (k === 3) return 'rgba(180, 52, 45, 0.30)';
  const t = k / Math.max(n - 1, 1);
  return `rgba(237, 230, 211, ${Math.max(0.05, 0.22 * (1 - (t - 0.2) / 0.8)).toFixed(3)})`;
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
