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
        'inline-flex items-center rounded-sm border border-paper-200 bg-paper-50',
        compact ? 'h-8' : 'h-9',
      )}
    >
      <button
        type="button"
        aria-label="decrease belief"
        onClick={() => onChange(clamp(value - 1))}
        disabled={value <= -10}
        className="grid h-full w-7 place-items-center text-ink-500 transition hover:text-rose-deep disabled:opacity-30"
      >
        <Minus size={12} />
      </button>
      <span
        className={cn(
          'min-w-[28px] text-center font-mono text-[11px] tabular-nums',
          value === 0 && 'text-ink-400',
          value > 0 && 'text-rose-deep font-medium',
          value < 0 && 'text-signal-red font-medium',
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
        className="grid h-full w-7 place-items-center text-ink-500 transition hover:text-rose-deep disabled:opacity-30"
      >
        <Plus size={12} />
      </button>
    </div>
  );
}
