'use client';

import { LayoutGroup, motion } from 'framer-motion';
import { Silk } from '@/components/silk';
import { BeliefStepper } from '@/components/belief-stepper';
import { cn, fmtML, pct } from '@/lib/utils';
import type { Horse, HorseResult } from '@/lib/types';

const BAR_TWEEN = { duration: 0.55, ease: [0.22, 1, 0.36, 1] } as const;
const ROW_TWEEN = { duration: 0.45, ease: [0.22, 1, 0.36, 1] } as const;

/**
 * Signature visualization.
 *
 * One row per horse. Each row is a single 100%-wide bar divided into N
 * segments — one per finish position (1st on the left, Nth on the right).
 * Each segment's width is the probability the horse finishes at that
 * position. The leftmost (P(win)) segment is saturated rose; segments fade
 * toward the tail. The shape of each row's distribution — how much mass
 * sits in the "top four" vs. the deep tail — is the thing.
 */
export function ProbabilityChart({
  field,
  results,
  beliefs,
  onBeliefChange,
  loading,
  sortByModel = true,
}: {
  field: Horse[];
  results: HorseResult[] | null;
  beliefs: Record<string, number>;
  onBeliefChange?: (horseId: string, value: number) => void;
  loading: boolean;
  sortByModel?: boolean;
}) {
  const horsesById = new Map(field.map((h) => [h.id, h]));
  const rows = results
    ? [...results].sort((a, b) =>
        sortByModel
          ? b.p_win - a.p_win
          : a.post_position - b.post_position,
      )
    : field.map((h) => ({
        id: h.id,
        name: h.name,
        post_position: h.post_position,
        p_win: 0,
        p_top3: 0,
        p_top4: 0,
        mean_finish: 0,
        finish_histogram: new Array(field.length).fill(1 / field.length),
      }));

  return (
    <div className="relative">
      {loading && (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-[2px] overflow-hidden">
          <div className="h-full w-1/3 animate-shimmer bg-gradient-to-r from-transparent via-rose-glow to-transparent" />
        </div>
      )}

      {/* Column headers */}
      <div className="mb-4 grid grid-cols-[32px_22px_minmax(0,1fr)_60px_minmax(0,2.2fr)_58px_74px] items-center gap-3 border-b border-bone-200/[0.08] pb-3 font-mono text-[10px] uppercase tracking-[0.16em] text-bone-600 md:grid-cols-[32px_22px_minmax(0,1fr)_60px_minmax(0,2.6fr)_58px_74px]">
        <span className="text-right">Post</span>
        <span />
        <span>Horse</span>
        <span className="text-right">P(win)</span>
        <span>Finish distribution (1st → last)</span>
        <span className="text-right">ML</span>
        <span className="text-right">Belief ±</span>
      </div>

      <LayoutGroup>
      <ol className="flex flex-col">
        {rows.map((r, i) => {
          const horse = horsesById.get(r.id);
          if (!horse) return null;
          const belief = beliefs[r.id] ?? 0;
          return (
            <motion.li
              key={r.id}
              layout
              transition={ROW_TWEEN}
              className={cn(
                'grid grid-cols-[32px_22px_minmax(0,1fr)_60px_minmax(0,2.2fr)_58px_74px] items-center gap-3 py-3 md:grid-cols-[32px_22px_minmax(0,1fr)_60px_minmax(0,2.6fr)_58px_74px]',
                i < rows.length - 1 && 'border-b border-bone-200/[0.05]',
              )}
            >
              <span className="text-right font-mono text-[11px] tabular-nums text-bone-500">
                {r.post_position.toString().padStart(2, '0')}
              </span>
              <Silk silk={horse.silk} size={18} />
              <span className="flex items-baseline gap-2 truncate">
                <span className="font-display text-[19px] leading-none text-bone-100">
                  {r.name}
                </span>
                <span className="hidden font-mono text-[10px] uppercase tracking-[0.12em] text-bone-600 md:inline">
                  {horse.running_style}
                </span>
              </span>
              <span
                className={cn(
                  'text-right font-mono text-[13px] tabular-nums',
                  r.p_win > 0.2 ? 'text-rose-glow' : 'text-bone-200',
                  loading && 'animate-pulseSoft',
                )}
              >
                {pct(r.p_win, 1)}
              </span>
              <DistributionBar histogram={r.finish_histogram} />
              <span className="text-right font-mono text-[11px] tabular-nums text-bone-500">
                {fmtML(horse.morning_line)}
              </span>
              <div className="flex justify-end">
                {onBeliefChange ? (
                  <BeliefStepper
                    value={belief}
                    onChange={(v) => onBeliefChange(r.id, v)}
                    compact
                  />
                ) : (
                  <span className="font-mono text-[11px] tabular-nums text-bone-500">
                    {belief === 0 ? '—' : (belief > 0 ? `+${belief}` : belief)}
                  </span>
                )}
              </div>
            </motion.li>
          );
        })}
      </ol>
      </LayoutGroup>
    </div>
  );
}

/** Renders the N-segment bar for a single horse. */
function DistributionBar({ histogram }: { histogram: number[] }) {
  // Colors computed once so the export PNG matches the live view exactly.
  const segments = histogram.map((p, k) => ({ p, color: rosesAt(k, histogram.length) }));
  return (
    <div
      className="relative flex h-[22px] overflow-hidden rounded-[1px] bg-ink-900 ring-1 ring-inset ring-bone-200/[0.05]"
      aria-label={`Finish distribution, position 1 through ${histogram.length}`}
    >
      {segments.map(({ p, color }, k) => (
        <motion.span
          key={k}
          title={`P(finish ${k + 1}) = ${(p * 100).toFixed(2)}%`}
          initial={false}
          animate={{ width: `${p * 100}%` }}
          transition={BAR_TWEEN}
          style={{
            background: color,
            borderRight:
              k < segments.length - 1 && p > 0.001
                ? '1px solid rgba(7,9,15,0.55)'
                : 'none',
          }}
          className="h-full"
        />
      ))}
    </div>
  );
}

/** Rose with decaying alpha. Position 1 = full roses red; position N ≈ hairline. */
function rosesAt(index: number, length: number): string {
  // P(win) bar: saturated roses red. Ramp down by position.
  // A geometric decay keeps the top-4 legible without drowning out the tail.
  const t = index / Math.max(length - 1, 1); // 0 at pos 1, 1 at pos N
  if (index === 0) return 'rgba(180, 52, 45, 0.98)';
  if (index === 1) return 'rgba(180, 52, 45, 0.60)';
  if (index === 2) return 'rgba(180, 52, 45, 0.42)';
  if (index === 3) return 'rgba(180, 52, 45, 0.30)';
  // From position 5 onward, blend to bone so the tail reads as "cold" not "red".
  const mid = Math.max(0, 0.22 * (1 - (t - 0.2) / 0.8));
  const alpha = Math.max(0.05, mid);
  return `rgba(237, 230, 211, ${alpha.toFixed(3)})`;
}
