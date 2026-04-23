'use client';

import { useEffect, useState } from 'react';
import type { Horse, HorseResult, ResultFile, SimResponse } from '@/lib/types';
import { cn, fmtML, mlToProb, pct } from '@/lib/utils';
import { Silk } from '@/components/silk';

/** Pre-race scenario used for the scorecard comparison (fast/honest neutral). */
const NEUTRAL_SCENARIO = { track: 'fast', pace: 'honest', beliefs: {} };

export function Scorecard({ field, result }: { field: Horse[]; result: ResultFile }) {
  const [preRace, setPreRace] = useState<HorseResult[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(NEUTRAL_SCENARIO),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: SimResponse) => setPreRace(d.results))
      .catch((e) => setErr((e as Error).message));
  }, []);

  if (result.meta.status !== 'official' || !result.finish_order.length) {
    return <PendingCard />;
  }

  if (err) {
    return (
      <div className="rounded-sm border border-rose/40 bg-rose/[0.08] p-4 font-mono text-[11px] text-rose-glow">
        Couldn&apos;t load pre-race probabilities: {err}
      </div>
    );
  }

  if (!preRace) {
    return <LoadingCard />;
  }

  return <ScorecardBody field={field} result={result} preRace={preRace} />;
}

function PendingCard() {
  return (
    <div className="rounded-sm border border-bone-200/[0.10] editorial-card p-8 md:p-12">
      <div className="flex flex-col items-start gap-5">
        <span className="eyebrow">Status · Pending</span>
        <h2 className="font-display text-3xl italic leading-tight text-bone-100 md:text-4xl">
          Grades post on May 3.
        </h2>
        <p className="max-w-xl text-[15px] leading-relaxed text-bone-400">
          Once the 2026 Derby is in the books, we&apos;ll publish the
          model&apos;s pre-race P(win) alongside the actual finish order, the
          Brier score against the morning line, and a plain-English writeup
          of what the model got right and wrong. Until then, this page sits
          empty on purpose.
        </p>
        <div className="mt-2 grid grid-cols-2 gap-x-12 gap-y-3 font-mono text-[11px] uppercase tracking-[0.16em] text-bone-500 md:grid-cols-4">
          <Stat label="Race" value="Kentucky Derby 152" />
          <Stat label="Date" value="May 2, 2026" />
          <Stat label="Post time" value="6:57 PM ET" />
          <Stat label="Model iter." value="1,000,000" />
        </div>
      </div>
    </div>
  );
}

function LoadingCard() {
  return (
    <div className="flex h-48 items-center justify-center rounded-sm border border-bone-200/[0.10] editorial-card">
      <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-bone-500 animate-pulseSoft">
        Loading pre-race probabilities…
      </span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-bone-600">{label}</span>
      <span className="text-bone-300">{value}</span>
    </div>
  );
}

function ScorecardBody({
  field,
  result,
  preRace,
}: {
  field: Horse[];
  result: ResultFile;
  preRace: HorseResult[];
}) {
  const byId = new Map(field.map((h) => [h.id, h]));
  const preById = new Map(preRace.map((r) => [r.id, r]));
  const actualById = new Map(result.finish_order.map((f) => [f.horse_id, f.position]));

  // Brier score: (1/N) * Σ (p_win_i − 1{horse i won})²
  const winner = result.finish_order.find((f) => f.position === 1)?.horse_id;
  const brierModel =
    preRace.reduce((acc, r) => {
      const won = r.id === winner ? 1 : 0;
      return acc + (r.p_win - won) ** 2;
    }, 0) / preRace.length;
  const brierML =
    preRace.reduce((acc, r) => {
      const horse = byId.get(r.id);
      const p = mlToProb(horse?.morning_line) ?? 1 / preRace.length;
      const won = r.id === winner ? 1 : 0;
      return acc + (p - won) ** 2;
    }, 0) / preRace.length;

  // Log-loss over the winner only (categorical cross-entropy).
  const winnerPre = winner ? preById.get(winner) : undefined;
  const logLossModel = winnerPre ? -Math.log(Math.max(winnerPre.p_win, 1e-6)) : null;
  const winnerML = winner ? mlToProb(byId.get(winner)?.morning_line) : null;
  const logLossML = winnerML ? -Math.log(Math.max(winnerML, 1e-6)) : null;

  const rowsByActual = [...result.finish_order].sort((a, b) => a.position - b.position);

  return (
    <div className="flex flex-col gap-8">
      <section className="grid gap-4 md:grid-cols-3">
        <Card label="Winner" value={winner ? byId.get(winner)?.name ?? winner : '—'} />
        <Card
          label="Brier (model / ML)"
          value={
            brierML > 0
              ? `${brierModel.toFixed(3)}  /  ${brierML.toFixed(3)}`
              : `${brierModel.toFixed(3)}`
          }
        />
        <Card
          label="Log-loss (model / ML)"
          value={
            logLossModel !== null && logLossML !== null
              ? `${logLossModel.toFixed(2)}  /  ${logLossML.toFixed(2)}`
              : logLossModel !== null
                ? logLossModel.toFixed(2)
                : '—'
          }
        />
      </section>

      <section className="rounded-sm border border-bone-200/[0.08] editorial-card overflow-hidden">
        <header className="grid grid-cols-[48px_24px_minmax(0,1fr)_80px_80px_80px] items-center gap-3 border-b border-bone-200/[0.08] px-5 py-3 font-mono text-[10px] uppercase tracking-[0.18em] text-bone-500">
          <span className="text-right">Actual</span>
          <span />
          <span>Horse</span>
          <span className="text-right">Model P</span>
          <span className="text-right">ML P</span>
          <span className="text-right">Surprise</span>
        </header>
        <ol>
          {rowsByActual.map((f) => {
            const horse = byId.get(f.horse_id);
            const pre = preById.get(f.horse_id);
            if (!horse || !pre) return null;
            const mlP = mlToProb(horse.morning_line);
            const surprise = mlP != null ? pre.p_win - mlP : null;
            return (
              <li
                key={f.horse_id}
                className={cn(
                  'grid grid-cols-[48px_24px_minmax(0,1fr)_80px_80px_80px] items-center gap-3 border-b border-bone-200/[0.05] px-5 py-3 last:border-b-0',
                  f.position === 1 && 'bg-rose/[0.06]',
                )}
              >
                <span
                  className={cn(
                    'text-right font-mono text-[13px] tabular-nums',
                    f.position === 1 ? 'text-rose-glow' : 'text-bone-300',
                  )}
                >
                  {f.position}
                </span>
                <Silk silk={horse.silk} size={18} />
                <span className="flex items-baseline gap-2 truncate">
                  <span className="font-display text-[18px] italic leading-none text-bone-100">
                    {horse.name}
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-bone-600">
                    {horse.running_style}
                  </span>
                </span>
                <span className="text-right font-mono text-[12px] tabular-nums text-bone-200">
                  {pct(pre.p_win, 1)}
                </span>
                <span className="text-right font-mono text-[12px] tabular-nums text-bone-500">
                  {mlP != null ? pct(mlP, 1) : '—'}
                </span>
                <span
                  className={cn(
                    'text-right font-mono text-[12px] tabular-nums',
                    surprise != null && Math.abs(surprise) > 0.05
                      ? surprise > 0
                        ? 'text-rose-glow'
                        : 'text-bone-400'
                      : 'text-bone-500',
                  )}
                >
                  {surprise != null
                    ? `${surprise > 0 ? '+' : ''}${(surprise * 100).toFixed(1)}pp`
                    : '—'}
                </span>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-sm border border-bone-200/[0.08] editorial-card px-5 py-4">
      <div className="eyebrow">{label}</div>
      <div className="mt-2 font-mono text-[16px] tabular-nums text-bone-100">{value}</div>
    </div>
  );
}
