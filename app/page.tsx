import { loadField } from '@/lib/field';
import { Simulator } from '@/components/simulator';
import { RevealStagger } from '@/components/reveal';

export const dynamic = 'force-static';

export default async function HomePage() {
  const field = await loadField();
  const isExample = !field.meta.updated || new Date(field.meta.date) > new Date();
  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-12 px-5 py-10 md:gap-14 md:px-8 md:py-16">
      {/* Hero */}
      <section className="flex flex-col gap-5 border-b border-paper-200 pb-12">
        <RevealStagger stagger={0.09}>
          <div className="flex items-center gap-3">
            <span className="eyebrow">{field.meta.race}</span>
            <span className="h-px flex-1 bg-paper-200" />
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">
              {field.meta.date} · {field.meta.distance ?? '1¼ miles'} · {field.meta.surface ?? 'dirt'}
            </span>
          </div>
          <h1 className="font-display text-[44px] italic leading-[1.02] text-ink-900 md:text-[88px]">
            One million
            <br />
            <span className="text-ink-700">Derbies, rerun.</span>
          </h1>
          <p className="max-w-2xl text-[16px] leading-relaxed text-ink-700 md:text-[17px]">
            A Monte Carlo model of the 2026 Kentucky Derby. Every slider change
            reruns the simulation and redraws the probability distribution over
            the full 20-horse field. The model is public and the math is
            documented on the{' '}
            <a
              href="/methodology"
              className="text-ink-900 underline decoration-rose-deep decoration-2 underline-offset-4 transition hover:text-rose-deep"
            >
              methodology
            </a>{' '}
            page — so you can argue with it.
          </p>
          {isExample && (
            <div className="inline-flex w-fit items-center gap-3 rounded-sm border border-paper-200 bg-paper-100 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-600">
              <span className="h-[6px] w-[6px] rounded-full bg-gold" />
              Pre-draw · {field.horses.length} Derby Trail contenders. Final 20-horse
              field lands at the post draw on April 25.
            </div>
          )}
        </RevealStagger>
      </section>

      <Simulator field={field.horses} />
    </div>
  );
}
