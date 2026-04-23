import { loadField } from '@/lib/field';
import { Simulator } from '@/components/simulator';
import { RevealStagger } from '@/components/reveal';
import { Horseshoe } from '@/components/graphics';

export const dynamic = 'force-static';

export default async function HomePage() {
  const field = await loadField();
  const isExample = !field.meta.updated || new Date(field.meta.date) > new Date();
  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-12 px-5 py-10 md:gap-14 md:px-8 md:py-16">
      {/* Hero */}
      <section className="flex flex-col gap-5 border-b border-paper-200 pb-12">
        <RevealStagger stagger={0.09}>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <span className="flex items-center gap-2">
              <Horseshoe size={14} />
              <span className="eyebrow">{field.meta.race}</span>
            </span>
            <span className="hidden h-px flex-1 bg-paper-200 sm:block" />
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-500">
              {field.meta.date} · {field.meta.distance ?? '1¼ miles'} · {field.meta.surface ?? 'dirt'}
            </span>
          </div>
          <h1 className="font-display text-[40px] italic leading-[1.04] text-ink-900 sm:text-[56px] md:text-[88px]">
            One million
            <br />
            <span className="text-ink-700">Derbies, rerun.</span>
          </h1>
          <p className="max-w-2xl text-[15px] leading-relaxed text-ink-700 sm:text-[16px] md:text-[17px]">
            A Monte Carlo model of the 2026 Kentucky Derby. Every slider change
            reruns the simulation and redraws the probability distribution over
            the full 20-horse field. The model is public and the math is
            documented on the{' '}
            <a href="/methodology" className="link">
              methodology
            </a>{' '}
            page — so you can argue with it.
          </p>
          {isExample && (
            <div className="flex items-start gap-3 rounded-sm border border-paper-200 bg-paper-100 px-4 py-3 font-mono text-[10px] uppercase leading-snug tracking-[0.12em] text-ink-600">
              <span className="mt-1 h-[6px] w-[6px] flex-shrink-0 rounded-full bg-gold" />
              <span>
                Pre-draw · {field.horses.length} Derby Trail contenders. Final
                20-horse field lands at the post draw on April 25.
              </span>
            </div>
          )}
        </RevealStagger>
      </section>

      <Simulator field={field.horses} />
    </div>
  );
}
