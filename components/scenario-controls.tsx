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
        className="flex overflow-hidden rounded-sm border border-bone-200/[0.10]"
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
                'group relative flex-1 px-3 py-2 text-left transition',
                'border-r border-bone-200/[0.08] last:border-r-0',
                active
                  ? 'bg-rose/[0.12] text-bone-100'
                  : 'bg-ink-900/60 text-bone-400 hover:bg-ink-800 hover:text-bone-200',
              )}
            >
              <span
                className={cn(
                  'block font-mono text-[11px] uppercase tracking-[0.14em]',
                  active ? 'text-rose-glow' : '',
                )}
              >
                {opt.label}
              </span>
              {opt.hint && (
                <span className="mt-0.5 block font-sans text-[10px] leading-tight text-bone-500">
                  {opt.hint}
                </span>
              )}
              {active && (
                <motion.span
                  layoutId={`segmented-active-${label}`}
                  aria-hidden
                  className="absolute inset-x-0 bottom-0 h-[1.5px] bg-rose"
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
