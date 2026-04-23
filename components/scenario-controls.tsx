'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { PaceScenario, TrackCondition } from '@/lib/types';

const TRACKS: { value: TrackCondition; label: string }[] = [
  { value: 'fast', label: 'Fast' },
  { value: 'good', label: 'Good' },
  { value: 'sloppy', label: 'Sloppy' },
  { value: 'muddy', label: 'Muddy' },
];

const PACES: { value: PaceScenario; label: string; hint: string }[] = [
  { value: 'slow', label: 'Slow', hint: 'Front-runners benefit' },
  { value: 'honest', label: 'Honest', hint: 'Neutral' },
  { value: 'fast', label: 'Fast', hint: 'Closers benefit' },
];

function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; hint?: string }[];
  label: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="eyebrow">{label}</span>
      <div
        role="radiogroup"
        aria-label={label}
        className="grid gap-px overflow-hidden rounded-sm bg-paper-200"
        style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
      >
        {options.map((opt) => {
          const active = opt.value === value;
          return (
            <button
              key={opt.value}
              role="radio"
              aria-checked={active}
              onClick={() => onChange(opt.value)}
              className={cn(
                'group relative min-h-[44px] px-3 py-2.5 text-left transition',
                active
                  ? 'bg-paper-50 text-ink-900'
                  : 'bg-paper-50 text-ink-600 hover:bg-paper-100 hover:text-ink-900',
              )}
            >
              <span
                className={cn(
                  'block font-mono text-[11px] uppercase tracking-[0.12em]',
                  active ? 'text-rose-deep' : '',
                )}
              >
                {opt.label}
              </span>
              {opt.hint && (
                <span className="mt-0.5 block font-sans text-[10px] leading-tight text-ink-500">
                  {opt.hint}
                </span>
              )}
              {active && (
                <motion.span
                  layoutId={`segmented-active-${label}`}
                  aria-hidden
                  className="absolute inset-x-0 bottom-0 h-[2px] bg-rose-deep"
                  transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ScenarioControls({
  track,
  pace,
  onTrackChange,
  onPaceChange,
}: {
  track: TrackCondition;
  pace: PaceScenario;
  onTrackChange: (v: TrackCondition) => void;
  onPaceChange: (v: PaceScenario) => void;
}) {
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <Segmented
        label="Track condition"
        value={track}
        onChange={onTrackChange}
        options={TRACKS}
      />
      <Segmented
        label="Pace scenario"
        value={pace}
        onChange={onPaceChange}
        options={PACES}
      />
    </div>
  );
}
