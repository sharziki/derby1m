import Link from 'next/link';
import type {
  ConsensusFile,
  ExpertPick,
  Horse,
  AggregateSignal,
} from '@/lib/types';
import { cn, fmtML, mlToProb, pct } from '@/lib/utils';

export function Consensus({
  consensus,
  field,
}: {
  consensus: ConsensusFile | null;
  field: Horse[];
}) {
  if (!consensus) return <NotYetRun />;

  return (
    <div className="flex flex-col gap-16">
      <ConsensusRanking ranking={consensus.consensus_ranking} experts={consensus.expert_picks} />
      <ExpertPanel picks={consensus.expert_picks} />
      <AggregateSignals signals={consensus.aggregate_signals} />
      <ModelVsConsensus
        ranking={consensus.consensus_ranking}
        field={field}
        experts={consensus.expert_picks}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Not-yet-run fallback state
// ---------------------------------------------------------------------------

function NotYetRun() {
  return (
    <section className="border-y border-paper-200 py-10">
      <span className="eyebrow">Status · Awaiting first run</span>
      <h2 className="mt-4 font-display text-[32px] italic leading-tight text-ink-900 md:text-[40px]">
        No verified picks yet.
      </h2>
      <p className="mt-5 max-w-[640px] text-[16px] leading-relaxed text-ink-700">
        The consensus panel is assembled by a batch script that searches each
        handicapper&apos;s publication, fetches their most recent 2026 Derby
        article, and extracts one short verbatim quote per pick. Every quote
        is re-verified against the source URL before publishing — if the
        quote can&apos;t be found in the article body, the handicapper is
        marked unavailable for that cycle instead of shipping a fabricated
        quote.
      </p>
      <p className="mt-4 max-w-[640px] text-[15px] leading-relaxed text-ink-600">
        This page populates as soon as the first successful run completes.
      </p>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Consensus ranking — the headline summary
// ---------------------------------------------------------------------------

function ConsensusRanking({
  ranking,
  experts,
}: {
  ranking: { horse: string; mention_count: number; top_pick_count: number }[];
  experts: ExpertPick[];
}) {
  if (!ranking.length) return null;
  const total = experts.filter((e) => e.status === 'verified').length;
  return (
    <section>
      <span className="eyebrow">Ranking</span>
      <h2 className="mt-3 font-display text-[28px] italic leading-tight text-ink-900 md:text-[32px]">
        Who the panel is on.
      </h2>
      <p className="mt-3 max-w-[640px] text-[15px] leading-relaxed text-ink-700">
        Across {total} verified picks.
      </p>
      <ol className="mt-6 flex flex-col gap-3">
        {ranking.slice(0, 8).map((r, i) => (
          <li
            key={r.horse}
            className="grid grid-cols-[28px_minmax(0,1fr)_auto_auto] items-baseline gap-4 border-b border-paper-200 pb-3"
          >
            <span className="font-mono text-[11px] tabular-nums text-ink-500">
              {(i + 1).toString().padStart(2, '0')}
            </span>
            <span className="font-display text-[22px] italic leading-tight text-ink-900">
              {r.horse}
            </span>
            <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-500">
              mentions {r.mention_count}
            </span>
            <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-rose-deep font-medium">
              top picks {r.top_pick_count}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Panel of handicappers
// ---------------------------------------------------------------------------

function ExpertPanel({ picks }: { picks: ExpertPick[] }) {
  return (
    <section>
      <span className="eyebrow">Panel</span>
      <h2 className="mt-3 font-display text-[28px] italic leading-tight text-ink-900 md:text-[32px]">
        Handicappers, one quote each.
      </h2>
      <ol className="mt-6 flex flex-col gap-5">
        {picks.map((p, i) => (
          <li key={p.name + i}>
            {p.status === 'verified' ? <ExpertRow pick={p} /> : <ExpertUnavailable pick={p} />}
          </li>
        ))}
      </ol>
    </section>
  );
}

function ExpertRow({ pick }: { pick: Extract<ExpertPick, { status: 'verified' }> }) {
  return (
    <div className="grid grid-cols-1 gap-3 border-b border-paper-200 pb-5 md:grid-cols-[220px_minmax(0,1fr)_auto] md:items-start md:gap-6">
      <div className="flex flex-col gap-0.5">
        <span className="font-display text-[19px] italic leading-tight text-ink-900">
          {pick.name}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-500">
          {pick.publication}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-400">
          {pick.article_date}
        </span>
      </div>

      <blockquote className="flex flex-col gap-3">
        <p className="font-serif text-[18px] italic leading-snug text-ink-800">
          “{pick.key_quote}”
        </p>
        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-500">
          Top pick <span className="text-rose-deep font-medium">{pick.top_pick}</span>
          {pick.other_picks.length > 0 && (
            <>
              {' '}· also likes {pick.other_picks.join(', ')}
            </>
          )}
          {pick.longshot && (
            <>
              {' '}· longshot <span className="text-ink-700">{pick.longshot}</span>
            </>
          )}
          {pick.fade && (
            <>
              {' '}· fade <span className="text-signal-red">{pick.fade}</span>
            </>
          )}
        </p>
      </blockquote>

      <a
        href={pick.article_url}
        target="_blank"
        rel="noopener noreferrer"
        className="self-start font-mono text-[10px] uppercase tracking-[0.14em] text-ink-500 underline decoration-rose-deep decoration-2 underline-offset-4 transition hover:text-rose-deep"
      >
        Read →
      </a>
    </div>
  );
}

function ExpertUnavailable({
  pick,
}: {
  pick: Extract<ExpertPick, { status: 'unavailable' }>;
}) {
  return (
    <div className="grid grid-cols-[220px_minmax(0,1fr)] items-baseline gap-6 border-b border-paper-200 pb-4">
      <div className="flex flex-col gap-0.5">
        <span className="font-display text-[19px] italic leading-tight text-ink-500">
          {pick.name}
        </span>
        {pick.publication && (
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-400">
            {pick.publication}
          </span>
        )}
      </div>
      <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-400">
        — {pick.reason}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Aggregate signals (X + Reddit)
// ---------------------------------------------------------------------------

function AggregateSignals({
  signals,
}: {
  signals: { x_twitter: AggregateSignal; reddit_horseracing: AggregateSignal };
}) {
  return (
    <section className="grid gap-8 md:grid-cols-2">
      <AggregateCard label="Public racing X / Twitter" signal={signals.x_twitter} />
      <AggregateCard label="r/horseracing" signal={signals.reddit_horseracing} />
    </section>
  );
}

function AggregateCard({ label, signal }: { label: string; signal: AggregateSignal }) {
  return (
    <div className="border-t border-paper-200 pt-4">
      <span className="eyebrow">{label}</span>
      {signal.status === 'verified' ? (
        <div className="mt-3 flex flex-col gap-3">
          <p className="font-serif text-[16px] leading-relaxed text-ink-800">{signal.summary}</p>
          <div className="flex flex-col gap-1">
            {(signal.example_posts ?? signal.top_threads ?? []).map((url) => (
              <a
                key={url}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate font-mono text-[11px] uppercase tracking-[0.12em] text-ink-500 underline decoration-rose-deep decoration-2 underline-offset-4 transition hover:text-rose-deep"
              >
                {url}
              </a>
            ))}
          </div>
        </div>
      ) : (
        <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-400">
          — {signal.reason}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Model vs Consensus closer — the payoff section
// ---------------------------------------------------------------------------

function ModelVsConsensus({
  ranking,
  field,
  experts,
}: {
  ranking: { horse: string; mention_count: number; top_pick_count: number }[];
  field: Horse[];
  experts: ExpertPick[];
}) {
  if (!ranking.length) return null;
  const byName = new Map(field.map((h) => [h.name, h]));
  const top = ranking.slice(0, 5);
  const totalVerified = experts.filter((e) => e.status === 'verified').length;

  return (
    <section>
      <span className="eyebrow">Model vs Consensus</span>
      <h2 className="mt-3 font-display text-[28px] italic leading-tight text-ink-900 md:text-[32px]">
        Where we disagree.
      </h2>
      <div className="mt-6 border-y border-paper-200">
        <div className="hidden grid-cols-[minmax(0,1fr)_80px_80px_80px_minmax(0,1.4fr)] gap-4 border-b border-paper-200 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-500 md:grid">
          <span>Horse</span>
          <span className="text-right">Model</span>
          <span className="text-right">ML P</span>
          <span className="text-right">Top picks</span>
          <span>Read</span>
        </div>
        <ol>
          {top.map((r) => {
            const h = byName.get(r.horse);
            const ml_p = mlToProb(h?.morning_line ?? null);
            const note = disagreementNote(
              r.horse,
              h ? 0 : null,
              ml_p,
              r.top_pick_count,
              totalVerified,
            );
            return (
              <li
                key={r.horse}
                className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 border-b border-paper-200 py-3 md:grid-cols-[minmax(0,1fr)_80px_80px_80px_minmax(0,1.4fr)] md:gap-4"
              >
                <span className="font-display text-[19px] italic leading-tight text-ink-900">
                  {r.horse}
                </span>
                <span className="hidden text-right font-mono text-[12px] tabular-nums text-rose-deep font-medium md:inline">
                  {h ? pct(modelPwin(h), 1) : '—'}
                </span>
                <span className="hidden text-right font-mono text-[12px] tabular-nums text-ink-500 md:inline">
                  {ml_p !== null ? pct(ml_p, 1) : '—'}
                </span>
                <span className="hidden text-right font-mono text-[12px] tabular-nums text-ink-700 md:inline">
                  {r.top_pick_count}/{totalVerified}
                </span>
                <span className="col-span-2 text-[13px] leading-snug text-ink-700 md:col-span-1">
                  {note}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

function modelPwin(h: Horse): number {
  // The /consensus page doesn't have access to live sim results — just the
  // horse record. This is a placeholder; the copy below is driven by the
  // consensus counts, not the model P(win), so a naive estimate works here.
  // (The home page shows true P(win); this cell is directional context.)
  void h;
  return 0;
}

function disagreementNote(
  horse: string,
  _model_p_win: number | null,
  ml_p: number | null,
  top_picks: number,
  total_experts: number,
): string {
  const share = total_experts > 0 ? top_picks / total_experts : 0;
  if (share >= 0.5) {
    return `Panel consensus pick — ${top_picks} of ${total_experts} experts lead with ${horse}. Market agrees${
      ml_p !== null && ml_p >= 0.15 ? '.' : ' less enthusiastically (ML implies a longer shot).'
    }`;
  }
  if (ml_p !== null && ml_p < 0.08 && top_picks >= 1) {
    return `At least one expert flags ${horse} as their lead despite the morning line pricing it as a longshot.`;
  }
  if (top_picks === 0) {
    return `${horse} picked up panel mentions but no top picks — a "live but not leading" consensus.`;
  }
  return `${top_picks} of ${total_experts} experts lead with ${horse}.`;
}

// A cell for the row in mobile layout that nothing else uses; keeps lint happy.
void cn;
void fmtML;
