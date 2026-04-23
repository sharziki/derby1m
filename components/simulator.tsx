'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  Horse,
  HorseResult,
  PaceScenario,
  Scenario,
  SimResponse,
  TrackCondition,
} from '@/lib/types';
import { ScenarioControls } from '@/components/scenario-controls';
import { ProbabilityChart } from '@/components/probability-chart';
import { ShareButton } from '@/components/share-button';
import { ShareSnapshot } from '@/components/share-snapshot';
import { cn } from '@/lib/utils';

const DEBOUNCE_MS = 300;
const DEFAULT_ITER = 1_000_000;

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
    // Abort any inflight request so stale responses don't overwrite fresh ones.
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const runId = ++runIdRef.current;

    setLoading(true);
    setError(null);
    try {
      const resp = await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(s),
        signal: controller.signal,
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = (await resp.json()) as SimResponse;
      if (runId !== runIdRef.current) return; // another run superseded us
      setResults(data.results);
      setMeta({ elapsed_ms: data.elapsed_ms, iterations: data.iterations });
    } catch (e) {
      if (controller.signal.aborted) return;
      setError(
        (e as Error).message ||
          'Simulation failed — is the API running? (npm run dev starts both)',
      );
    } finally {
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
    <div className="flex flex-col gap-8">
      {/* Scenario controls */}
      <section className="rounded-sm border border-bone-200/[0.08] editorial-card p-5 md:p-6">
        <div className="mb-5 flex items-center justify-between">
          <span className="eyebrow">Scenario</span>
          {activeBeliefCount > 0 && (
            <button
              onClick={() => setBeliefs({})}
              className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-500 transition hover:text-rose-glow"
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
      <section className="rounded-sm border border-bone-200/[0.08] editorial-card p-5 md:p-7">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-3xl italic leading-none text-bone-100 md:text-4xl">
              Finish probability
            </h2>
            <p className="mt-2 max-w-xl text-[13px] leading-snug text-bone-400">
              Each row is one horse. The bar shows how likely they are to
              finish at each position after a million simulated races —
              saturated rose for 1st, fading toward the tail.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={cn(
                'flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em]',
                loading ? 'text-rose-glow animate-pulseSoft' : 'text-bone-500',
              )}
            >
              <span
                className={cn(
                  'inline-block h-[6px] w-[6px] rounded-full',
                  loading ? 'bg-rose' : 'bg-bone-500',
                )}
              />
              {loading
                ? 'Simulating…'
                : meta
                  ? `${(meta.iterations / 1000).toFixed(0)}k × 1,000 · ${meta.elapsed_ms.toFixed(0)} ms`
                  : 'Idle'}
            </span>
            <ShareButton targetRef={snapshotRef} />
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-sm border border-rose/40 bg-rose/[0.08] px-4 py-3 font-mono text-[11px] text-rose-glow">
            {error}
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
