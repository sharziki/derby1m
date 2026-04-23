'use client';

import { useState } from 'react';
import { LayoutGroup, motion } from 'framer-motion';
import { Silk } from '@/components/silk';
import { BeliefStepper } from '@/components/belief-stepper';
import { cn, fmtML, pct } from '@/lib/utils';
import type { Horse, HorseResult } from '@/lib/types';

const BAR_TWEEN = { duration: 0.55, ease: [0.22, 1, 0.36, 1] } as const;
const ROW_LAYOUT_TWEEN = { duration: 0.45, ease: [0.22, 1, 0.36, 1] } as const;
const ROW_ENTRY_TWEEN = { duration: 0.5, ease: [0.22, 1, 0.36, 1] } as const;

/** Render the percentage as a plain string. The previous version routed the
 * value through useMotionValue/useTransform so digits would tween between
 * scenarios, but rendering a MotionValue as a React child is fragile —
 * framer-motion's special-cased codepath occasionally failed to update on
 * production hydration, so the cell stayed stuck. The regression test in
 * __tests__/render.test.tsx asserts the literal string. Animation lives at
 * the row + bar level, not on the digits. */
export function AnimatedPct({ value, decimals = 1 }: { value: number; decimals?: number }) {
  const formatted = `${(value * 100).toFixed(decimals)}%`;
  return (
    <motion.span
      key={formatted}
      initial={{ opacity: 0.55 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35 }}
    >
      {formatted}
    </motion.span>
  );
}

/**
 * Signature visualization. One row per horse. Each row is a 100%-wide bar
 * divided into N segments — one per finish position (1st left, Nth right).
 * Segment width = P(finish at that position). Color saturated rose-deep at
 * P(1st), fades to paper-200 at P(Nth).
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
  // Data-presence is the canonical "loaded" signal. The fetch can finish
  // without `loading` flipping (e.g. a re-render race), but if `results` is
  // populated we have something real to show.
  const hasResults = results !== null && results.length > 0;
  const horsesById = new Map(field.map((h) => [h.id, h]));
  const rows = results
    ? [...results].sort((a, b) =>
        sortByModel ? b.p_win - a.p_win : a.post_position - b.post_position,
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
    <div className="@container relative">
      {loading && (
        <div className="pointer-events-none absolute inset-x-0 -top-px z-10 h-[2px] overflow-hidden">
          <div className="h-full w-1/3 animate-shimmer bg-gradient-to-r from-transparent via-rose-deep to-transparent" />
        </div>
      )}

      {/* Column headers — only render at @3xl (768px container) where the
          desktop 7-column grid actually fits. Below that the row headers
          live inline. */}
      <div className="mb-3 hidden grid-cols-[28px_22px_minmax(0,1fr)_56px_minmax(0,2.2fr)_56px_96px] items-center gap-3 border-b border-paper-200 pb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-500 @3xl:grid">
        <span className="text-right">Post</span>
        <span />
        <span>Horse</span>
        <span className="text-right">P(win)</span>
        <span>Finish 1st → Last</span>
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
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{
                  default: { ...ROW_ENTRY_TWEEN, delay: i * 0.035 },
                  layout: ROW_LAYOUT_TWEEN,
                }}
                className={cn(
                  // Mobile / tablet: 2-row stacked layout (name+P-win on top,
                  // distribution bar full-width below, ML/style/belief strip).
                  // ≥@3xl (768px container): tight 7-column grid.
                  'grid grid-cols-[24px_18px_minmax(0,1fr)_56px] grid-rows-[auto_auto] items-center gap-x-3 gap-y-2 py-3',
                  '@3xl:grid-cols-[28px_22px_minmax(0,1fr)_56px_minmax(0,2.2fr)_56px_96px] @3xl:grid-rows-1 @3xl:gap-y-0',
                  i < rows.length - 1 && 'border-b border-paper-200',
                )}
              >
                <span className="row-span-1 text-right font-mono text-[11px] tabular-nums text-ink-500 @3xl:row-auto">
                  {r.post_position.toString().padStart(2, '0')}
                </span>
                <Silk silk={horse.silk} size={18} />
                <span className="flex min-w-0 items-baseline gap-2">
                  <span className="truncate font-display text-[20px] italic leading-tight text-ink-900">
                    {r.name}
                  </span>
                  <span className="hidden font-mono text-[10px] uppercase tracking-[0.10em] text-ink-500 @sm:inline">
                    {horse.running_style}
                  </span>
                </span>
                <span
                  className={cn(
                    'text-right font-mono text-[13px] tabular-nums',
                    !hasResults && 'text-ink-400',
                    hasResults && r.p_win > 0.2 && 'text-rose-deep font-medium',
                    hasResults && r.p_win <= 0.2 && 'text-ink-800',
                    loading && 'animate-pulseSoft',
                  )}
                >
                  {hasResults ? <AnimatedPct value={r.p_win} /> : <span>—</span>}
                </span>

                {/* Distribution bar — full row on mobile, inline at md */}
                <div className="col-span-4 -mx-1 @3xl:col-span-1 @3xl:mx-0">
                  <DistributionBar histogram={r.finish_histogram} hasResults={hasResults} />
                </div>

                <span className="hidden text-right font-mono text-[11px] tabular-nums text-ink-500 @3xl:inline">
                  {fmtML(horse.morning_line)}
                </span>
                <div className="hidden justify-end @3xl:flex">
                  {onBeliefChange ? (
                    <BeliefStepper
                      value={belief}
                      onChange={(v) => onBeliefChange(r.id, v)}
                      compact
                    />
                  ) : (
                    <span className="font-mono text-[11px] tabular-nums text-ink-500">
                      {belief === 0 ? '—' : belief > 0 ? `+${belief}` : belief}
                    </span>
                  )}
                </div>

                {/* Mobile-only belief stepper + ML, full-width row */}
                <div className="col-span-4 flex items-center justify-between border-t border-paper-200 pt-2 font-mono text-[11px] uppercase tracking-[0.10em] text-ink-500 @3xl:hidden">
                  <span>ML {fmtML(horse.morning_line)}</span>
                  <span className="flex items-center gap-2">
                    <span>{horse.running_style}</span>
                    {onBeliefChange && (
                      <BeliefStepper
                        value={belief}
                        onChange={(v) => onBeliefChange(r.id, v)}
                        compact
                      />
                    )}
                  </span>
                </div>
              </motion.li>
            );
          })}
        </ol>
      </LayoutGroup>
    </div>
  );
}

/** N-segment horizontal bar. */
function DistributionBar({
  histogram,
  hasResults,
}: {
  histogram: number[];
  hasResults: boolean;
}) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const segments = histogram.map((p, k) => ({ p, color: rosesAt(k, histogram.length) }));
  return (
    <div
      className="relative flex h-[20px] overflow-hidden rounded-[2px] bg-paper-200"
      aria-label={`Finish distribution, position 1 through ${histogram.length}`}
      onMouseLeave={() => setHoverIdx(null)}
    >
      {segments.map(({ p, color }, k) => (
        <motion.span
          key={k}
          title={
            hasResults
              ? `P(finish ${k + 1}) = ${(p * 100).toFixed(2)}%`
              : 'Awaiting simulation'
          }
          initial={false}
          animate={{ width: `${p * 100}%` }}
          transition={BAR_TWEEN}
          onMouseEnter={() => setHoverIdx(k)}
          style={{
            background: color,
            borderRight:
              k < segments.length - 1 && p > 0.001
                ? '1px solid rgba(255,255,255,0.55)'
                : 'none',
          }}
          className="h-full cursor-default"
        />
      ))}
      {hoverIdx !== null && hasResults && hoverIdx < 4 && (
        <div className="pointer-events-none absolute -top-7 left-0 rounded-sm border border-paper-200 bg-paper-50 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.10em] text-ink-700 shadow-rule">
          {ordinal(hoverIdx + 1)}: {pct(histogram[hoverIdx], 2)}
        </div>
      )}
    </div>
  );
}

function ordinal(n: number): string {
  if (n === 1) return '1st';
  if (n === 2) return '2nd';
  if (n === 3) return '3rd';
  return `${n}th`;
}

/** Saturated rose at P(1st), fades through rose-mid → rose-light → paper-200. */
function rosesAt(index: number, length: number): string {
  if (index === 0) return '#8B1A2B';                         // rose-deep
  if (index === 1) return '#B83A4E';                         // rose-mid
  if (index === 2) return '#D2737E';                         // between mid and light
  if (index === 3) return '#E8BCC4';                         // rose-light
  // Tail fades to paper-200 (background of bar). Use ink with low alpha so it
  // stays distinguishable but quiet.
  const t = (index - 3) / Math.max(length - 4, 1);
  const alpha = Math.max(0.06, 0.22 * (1 - t));
  return `rgba(122, 117, 108, ${alpha.toFixed(3)})`;          // ink-500 with alpha
}
