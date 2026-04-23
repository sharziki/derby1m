import type { Metadata } from 'next';
import { loadField, loadResult } from '@/lib/field';
import { Scorecard } from '@/components/scorecard';

export const metadata: Metadata = {
  title: 'Scorecard',
  description:
    'Derby/1M — what the model predicted vs. what actually happened. Populated on race day.',
};

export const dynamic = 'force-dynamic';

export default async function ScorecardPage() {
  const [field, result] = await Promise.all([loadField(), loadResult()]);
  return (
    <div className="mx-auto max-w-[1100px] px-6 py-12 md:px-10 md:py-16">
      <header className="mb-10 border-b border-bone-200/[0.08] pb-8">
        <span className="eyebrow">Derby/1M · Scorecard</span>
        <h1 className="mt-4 font-display text-5xl italic leading-[1.05] text-bone-100 md:text-6xl">
          What we said,
          <br />
          <span className="text-bone-200/80">what happened.</span>
        </h1>
        <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-bone-400">
          The model&apos;s pre-race P(win) distribution next to the actual
          finish order. Brier score, log-loss, and where the shape of the
          prediction agreed or diverged from the morning line.
        </p>
      </header>

      <Scorecard field={field.horses} result={result} />
    </div>
  );
}
