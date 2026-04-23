'use client';

import { useEffect, useState } from 'react';
import type { Horse, HorseResult, ResultFile, SimResponse } from '@/lib/types';
import { cn, mlToProb, pct } from '@/lib/utils';
import { Silk } from '@/components/silk';

const NEUTRAL_SCENARIO = { track: 'fast', pace: 'honest', beliefs: {} };

export function Scorecard({ field, result }: { field: Horse[]; result: ResultFile }) {
  const [preRace, setPreRace] = useState<HorseResult[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (result.meta.status !== 'official' || !result.finish_order.length) return;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 15_000);
    fetch('/api/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(NEUTRAL_SCENARIO),
      signal: ctrl.signal,
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: SimResponse) => setPreRace(d.results))
      .catch((e) => {
        if (!ctrl.signal.aborted) setErr((e as Error).message);
        else setErr('Pre-race load timed out');
      })
      .finally(() => clearTimeout(t));
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [result]);

  if (result.meta.status !== 'official' || !result.finish_order.length) {
    return <PendingCard date={result.meta.date} />;
  }

  if (err) {
    return (
      <div className="rounded-sm border border-signal-red/40 bg-rose-tint/40 p-4 font-mono text-[11px] text-signal-red">
        Couldn&apos;t load pre-race probabilities: {err}
      </div>
    );
  }

  if (!preRace) {
    return <LoadingCard />;
  }

  return <ScorecardBody field={field} result={result} preRace={preRace} />;
}

function PendingCard({ date }: { date: string }) {
  return (
    <article className="border-y border-paper-200 py-10 md:py-12">
      <span className="eyebrow">Status · Awaiting race</span>
      <h2 className="mt-4 font-display text-[32px] italic leading-tight text-ink-900 sm:text-[36px] md:text-[44px]">
        Grades post on May 3.
      </h2>
      <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-ink-700 sm:text-[16px]">
        The 2026 Kentucky Derby runs {date}. Once the race is in the books, this
        page will publish the model&apos;s pre-race P(win) alongside the actual
        finish order, the Brier score and log-loss against the morning line, and
        a plain-English writeup of what the model got right and wrong. Until
        then, this page sits empty on purpose — the point is to be measured, not
        to keep moving the goalposts.
      </p>
      <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-paper-200 pt-6 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-500 sm:gap-x-8 md:grid-cols-4">
        <Stat label="Race" value="Kentucky Derby 152" />
        <Stat label="Date" value="May 2, 2026" />
        <Stat label="Post time" value="6:57 PM ET" />
        <Stat label="Iterations" value="1,000,000" />
      </dl>
    </article>
  );
}

function LoadingCard() {
  return (
    <div className="flex h-48 items-center justify-center border-y border-paper-200">
      <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-500 animate-pulseSoft">
        Loading pre-race probabilities…
      </span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-ink-400">{label}</dt>
      <dd className="text-ink-700">{value}</dd>
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

  const winnerPre = winner ? preById.get(winner) : undefined;
  const logLossModel = winnerPre ? -Math.log(Math.max(winnerPre.p_win, 1e-6)) : null;
  const winnerML = winner ? mlToProb(byId.get(winner)?.morning_line) : null;
  const logLossML = winnerML ? -Math.log(Math.max(winnerML, 1e-6)) : null;

  // Top-4 from model (sorted by P(win)).
  const modelTop4 = [...preRace].sort((a, b) => b.p_win - a.p_win).slice(0, 4);
  // Top-4 actual (positions 1-4).
  const actualTop4 = [...result.finish_order]
    .sort((a, b) => a.position - b.position)
    .slice(0, 4);

  return (
    <div className="flex flex-col gap-12">
      <section className="grid gap-px overflow-hidden rounded-sm bg-paper-200 md:grid-cols-3">
        <Card label="Winner" value={winner ? byId.get(winner)?.name ?? winner : '—'} />
        <Card
          label="Brier — model / ML"
          value={
            brierML > 0
              ? `${brierModel.toFixed(3)} / ${brierML.toFixed(3)}`
              : `${brierModel.toFixed(3)}`
          }
          accent={brierModel < brierML ? 'green' : 'neutral'}
        />
        <Card
          label="Log-loss — model / ML"
          value={
            logLossModel !== null && logLossML !== null
              ? `${logLossModel.toFixed(2)} / ${logLossML.toFixed(2)}`
              : logLossModel !== null
                ? logLossModel.toFixed(2)
                : '—'
          }
          accent={
            logLossModel !== null && logLossML !== null && logLossModel < logLossML
              ? 'green'
              : 'neutral'
          }
        />
      </section>

      {/* Two-column comparison */}
      <section className="grid gap-10 md:grid-cols-2">
        <FinishColumn title="Model said" rows={modelTop4.map((r) => ({ id: r.id, label: pct(r.p_win, 1) }))} byId={byId} />
        <FinishColumn
          title="Actually happened"
          rows={actualTop4.map((f) => ({ id: f.horse_id, label: ordinal(f.position) }))}
          byId={byId}
        />
      </section>

      {/* Per-horse comparison table */}
      <section className="border-t border-paper-200">
        <header className="hidden grid-cols-[48px_24px_minmax(0,1fr)_80px_80px_88px] items-center gap-3 border-b border-paper-200 py-3 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-500 md:grid">
          <span className="text-right">Actual</span>
          <span />
          <span>Horse</span>
          <span className="text-right">Model P</span>
          <span className="text-right">ML P</span>
          <span className="text-right">Surprise</span>
        </header>
        <ol>
          {[...result.finish_order]
            .sort((a, b) => a.position - b.position)
            .map((f) => {
              const horse = byId.get(f.horse_id);
              const pre = preById.get(f.horse_id);
              if (!horse || !pre) return null;
              const mlP = mlToProb(horse.morning_line);
              const surprise = mlP != null ? pre.p_win - mlP : null;
              return (
                <li
                  key={f.horse_id}
                  className={cn(
                    'grid grid-cols-[36px_18px_minmax(0,1fr)_60px] items-center gap-2 border-b border-paper-200 py-3',
                    'md:grid-cols-[48px_24px_minmax(0,1fr)_80px_80px_88px] md:gap-3',
                    f.position === 1 && 'bg-rose-tint/40',
                  )}
                >
                  <span
                    className={cn(
                      'text-right font-mono text-[13px] tabular-nums',
                      f.position === 1 ? 'text-rose-deep font-medium' : 'text-ink-700',
                    )}
                  >
                    {f.position}
                  </span>
                  <Silk silk={horse.silk} size={18} />
                  <span className="flex items-baseline gap-2 truncate">
                    <span className="font-display text-[18px] italic leading-tight text-ink-900">
                      {horse.name}
                    </span>
                    <span className="hidden font-mono text-[10px] uppercase tracking-[0.10em] text-ink-500 md:inline">
                      {horse.running_style}
                    </span>
                  </span>
                  <span className="text-right font-mono text-[12px] tabular-nums text-ink-800">
                    {pct(pre.p_win, 1)}
                  </span>
                  <span className="hidden text-right font-mono text-[12px] tabular-nums text-ink-500 md:inline">
                    {mlP != null ? pct(mlP, 1) : '—'}
                  </span>
                  <span
                    className={cn(
                      'hidden text-right font-mono text-[12px] tabular-nums md:inline',
                      surprise != null && Math.abs(surprise) > 0.05
                        ? surprise > 0
                          ? 'text-signal-green'
                          : 'text-signal-red'
                        : 'text-ink-500',
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

      {/* Optional writeup from result.json */}
      {result.meta.note && (
        <section className="border-t border-paper-200 pt-8">
          <span className="eyebrow">Writeup</span>
          <p className="mt-3 max-w-2xl text-[16px] leading-relaxed text-ink-800">
            {result.meta.note}
          </p>
        </section>
      )}
    </div>
  );
}

function Card({
  label,
  value,
  accent = 'neutral',
}: {
  label: string;
  value: string;
  accent?: 'green' | 'neutral';
}) {
  return (
    <div className="bg-paper-50 px-5 py-5">
      <div className="eyebrow">{label}</div>
      <div
        className={cn(
          'mt-2 font-mono text-[18px] tabular-nums',
          accent === 'green' ? 'text-signal-green' : 'text-ink-900',
        )}
      >
        {value}
      </div>
    </div>
  );
}

function FinishColumn({
  title,
  rows,
  byId,
}: {
  title: string;
  rows: { id: string; label: string }[];
  byId: Map<string, Horse>;
}) {
  return (
    <div>
      <span className="eyebrow">{title}</span>
      <ol className="mt-3 flex flex-col gap-3">
        {rows.map((r, i) => {
          const horse = byId.get(r.id);
          return (
            <li
              key={r.id + i}
              className="flex items-center gap-3 border-b border-paper-200 pb-3"
            >
              <span className="font-mono text-[13px] tabular-nums text-ink-500">
                {i + 1}
              </span>
              {horse && <Silk silk={horse.silk} size={20} />}
              <span className="flex-1 font-display text-[22px] italic leading-tight text-ink-900">
                {horse?.name ?? r.id}
              </span>
              <span className="font-mono text-[12px] tabular-nums text-rose-deep">
                {r.label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function ordinal(n: number): string {
  if (n === 1) return '1st';
  if (n === 2) return '2nd';
  if (n === 3) return '3rd';
  return `${n}th`;
}

