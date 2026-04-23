'use client';

import { cn } from '@/lib/utils';
import { Minus, Plus } from 'lucide-react';

/**
 * +/- stepper for the per-horse "belief override" (additive Beyer-point shift).
 * Range: ±10. Step: 1.
 */
export function BeliefStepper({
  value,
  onChange,
  compact = false,
}: {
  value: number;
  onChange: (v: number) => void;
  compact?: boolean;
}) {
  const clamp = (n: number) => Math.max(-10, Math.min(10, n));
  const sign = value > 0 ? '+' : '';
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 rounded-sm border border-bone-200/[0.08] bg-ink-850/70',
        compact ? 'h-6' : 'h-7',
      )}
    >
      <button
        type="button"
        aria-label="decrease belief"
        onClick={() => onChange(clamp(value - 1))}
        disabled={value <= -10}
        className="grid h-full w-6 place-items-center text-bone-500 transition hover:text-rose-glow disabled:opacity-30"
      >
        <Minus size={11} />
      </button>
      <span
        className={cn(
          'min-w-[28px] text-center font-mono text-[11px] tabular-nums',
          value === 0 && 'text-bone-500',
          value > 0 && 'text-rose-glow',
          value < 0 && 'text-bone-400',
        )}
      >
        {sign}
        {value}
      </span>
      <button
        type="button"
        aria-label="increase belief"
        onClick={() => onChange(clamp(value + 1))}
        disabled={value >= 10}
        className="grid h-full w-6 place-items-center text-bone-500 transition hover:text-rose-glow disabled:opacity-30"
      >
        <Plus size={11} />
      </button>
    </div>
  );
}
