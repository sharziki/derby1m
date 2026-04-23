'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  Horse,
  HorseResult,
  PaceScenario,
  Scenario,
  TrackCondition,
} from '@/lib/types';
import { ScenarioControls } from '@/components/scenario-controls';
import { ProbabilityChart } from '@/components/probability-chart';
import { ShareButton } from '@/components/share-button';
import { ShareSnapshot } from '@/components/share-snapshot';
import { ShareTwitter } from '@/components/share-twitter';
import { cn } from '@/lib/utils';
import { validateSimResponse } from '@/lib/schema';

const DEBOUNCE_MS = 400;
const DEFAULT_ITER = 1_000_000;
const TIMEOUT_MS = 15_000;

export function Simulator({ field }: { field: Horse[] }) {
  const [track, setTrack] = useState<TrackCondition>('fast');
  const [pace, setPace] = useState<PaceScenario>('honest');
  const [beliefs, setBeliefs] = useState<Record<string, number>>({});
  const [results, setResults] = useState<HorseResult[] | null>(null);
  const [meta, setMeta] = useState<{ elapsed_ms: number; iterations: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const snapshotRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const runIdRef = useRef(0);

  const scenario: Scenario = useMemo(
    () => ({ track, pace, beliefs, iterations: DEFAULT_ITER }),
    [track, pace, beliefs],
  );

  const runSim = useCallback(async (s: Scenario) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const runId = ++runIdRef.current;
    const timer = setTimeout(() => {
      controller.abort();
    }, TIMEOUT_MS);

    setLoading(true);
    setError(null);
    try {
      // Route to the cached default endpoint when the scenario matches —
      // cuts Vercel function invocations for the most common page load.
      const isDefault =
        s.track === 'fast' &&
        s.pace === 'honest' &&
        Object.values(s.beliefs).every((v) => v === 0);
      const resp = isDefault
        ? await fetch('/api/simulate-default', { signal: controller.signal })
        : await fetch('/api/simulate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(s),
            signal: controller.signal,
          });
      if (resp.status === 429) {
        const body = await resp.json().catch(() => ({}));
        const retry = body?.retry_after ?? 60;
        throw new Error(
          `Too many requests — slow down and try again in ~${retry}s.`,
        );
      }
      if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        throw new Error(`HTTP ${resp.status}${text ? ` — ${text.slice(0, 120)}` : ''}`);
      }
      const raw = await resp.json();
      const data = validateSimResponse(raw);
      if (runId !== runIdRef.current) return;
      setResults(data.results as HorseResult[]);
      setMeta({ elapsed_ms: data.elapsed_ms, iterations: data.iterations });
    } catch (e) {
      if (runId !== runIdRef.current) return;
      if (controller.signal.aborted) {
        setError('Simulation timed out — the API took longer than 15s. Refresh to retry.');
      } else {
        const msg = (e as Error).message || 'Simulation failed';
        console.error('[simulator] sim error', e);
        setError(`${msg}`);
      }
    } finally {
      clearTimeout(timer);
      if (runId === runIdRef.current) setLoading(false);
    }
  }, []);

  // Initial run.
  useEffect(() => {
    runSim(scenario);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced re-runs on scenario change.
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    const t = setTimeout(() => runSim(scenario), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [scenario, runSim]);

  const onBelief = (id: string, v: number) =>
    setBeliefs((prev) => ({ ...prev, [id]: v }));

  const activeBeliefCount = Object.values(beliefs).filter((v) => v !== 0).length;

  return (
    <div className="flex flex-col gap-10">
      {/* Scenario controls — bare, no card */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <span className="eyebrow">Scenario</span>
          {activeBeliefCount > 0 && (
            <button
              onClick={() => setBeliefs({})}
              className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-500 transition hover:text-rose-deep"
            >
              Reset {activeBeliefCount} belief{activeBeliefCount === 1 ? '' : 's'}
            </button>
          )}
        </div>
        <ScenarioControls
          track={track}
          pace={pace}
          onTrackChange={setTrack}
          onPaceChange={setPace}
        />
      </section>

      {/* Chart */}
      <section className="flex flex-col gap-5">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-paper-200 pb-5">
          <div>
            <h2 className="font-display text-[34px] italic leading-[1.05] text-ink-900 md:text-[44px]">
              Finish probability
            </h2>
            <p className="mt-2 max-w-xl text-[15px] leading-snug text-ink-600">
              Each row is one horse. The bar shows how likely they are to finish
              at each position after a million simulated races — saturated rose
              for 1st, fading toward the tail.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={cn(
                'flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em]',
                loading ? 'text-rose-deep animate-pulseSoft' : 'text-ink-500',
              )}
              aria-live="polite"
            >
              <span
                className={cn(
                  'inline-block h-[6px] w-[6px] rounded-full',
                  loading ? 'bg-rose-deep' : 'bg-ink-400',
                )}
              />
              {loading
                ? 'Simulating…'
                : meta
                  ? `${(meta.iterations / 1000).toFixed(0)}k draws · ${meta.elapsed_ms.toFixed(0)} ms`
                  : 'Idle'}
            </span>
            <div className="flex items-center gap-2">
              <ShareButton targetRef={snapshotRef} />
              <ShareTwitter
                topHorse={
                  results && results.length > 0
                    ? [...results].sort((a, b) => b.p_win - a.p_win)[0].name
                    : null
                }
                topProbability={
                  results && results.length > 0
                    ? [...results].sort((a, b) => b.p_win - a.p_win)[0].p_win
                    : null
                }
              />
            </div>
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="flex flex-col gap-2 rounded-sm border border-signal-red/40 bg-rose-tint/40 px-4 py-3"
          >
            <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-signal-red">
              Simulation failed
            </div>
            <div className="text-[13px] leading-relaxed text-ink-700">{error}</div>
          </div>
        )}

        <ProbabilityChart
          field={field}
          results={results}
          beliefs={beliefs}
          onBeliefChange={onBelief}
          loading={loading}
        />
      </section>

      {/* Off-screen snapshot layout used by html-to-image */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: -99999,
          pointerEvents: 'none',
          opacity: 0,
        }}
        aria-hidden
      >
        <div ref={snapshotRef}>
          {results && (
            <ShareSnapshot field={field} results={results} scenario={scenario} />
          )}
        </div>
      </div>
    </div>
  );
}
