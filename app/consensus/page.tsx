import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { consensusReady, loadConsensus } from '@/lib/consensus';
import { loadField } from '@/lib/field';
import { Consensus } from '@/components/consensus';

export const metadata: Metadata = {
  title: 'Consensus',
  description:
    'What named handicappers are saying about the 2026 Kentucky Derby — synthesized from public articles with every quote verified against its source.',
};

export const dynamic = 'force-dynamic';

export default async function ConsensusPage() {
  // Prod hides this page until real verified data lands. In dev you can
  // still hit the route directly to preview the fallback state.
  if (process.env.NODE_ENV === 'production' && !(await consensusReady())) {
    notFound();
  }
  const [consensus, field] = await Promise.all([loadConsensus(), loadField()]);

  return (
    <article className="mx-auto max-w-[960px] px-5 py-12 md:px-8 md:py-16">
      <header className="mb-12 border-b border-paper-200 pb-10">
        <span className="eyebrow">Derby/1M · Consensus</span>
        <h1 className="mt-4 font-display text-[44px] italic leading-[1.05] text-ink-900 md:text-[60px]">
          What the experts say.
        </h1>
        <p className="mt-5 max-w-[600px] text-[16px] leading-relaxed text-ink-700 md:text-[17px]">
          Synthesized from public picks by eight named handicappers and two
          aggregate signals, updated{' '}
          {consensus?.generated_at
            ? new Date(consensus.generated_at).toISOString().slice(0, 10)
            : '—'}
          . Every quote links to its original article; every quote is
          re-verified against the source before publishing.
        </p>
      </header>

      <Consensus consensus={consensus} field={field.horses} />

      <footer className="mt-16 border-t border-paper-200 pt-6 text-[13px] leading-relaxed text-ink-500">
        Derby/1M does not reproduce full articles. Quotes shown here are
        limited excerpts — under 15 words each, one per article — used under
        fair use for commentary. Click through to read each handicapper&apos;s
        full analysis. The presence of a pick on this page is not an
        endorsement by the handicapper.
      </footer>
    </article>
  );
}
