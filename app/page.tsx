import { loadField } from '@/lib/field';
import { Simulator } from '@/components/simulator';

export const dynamic = 'force-static';

export default async function HomePage() {
  const field = await loadField();
  const isExample = !field.meta.updated || new Date(field.meta.date) > new Date();
  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-10 px-6 py-12 md:px-10 md:py-16">
      {/* Hero */}
      <section className="flex flex-col gap-5 border-b border-bone-200/[0.08] pb-10">
        <div className="flex items-center gap-3">
          <span className="eyebrow">{field.meta.race}</span>
          <span className="h-px flex-1 bg-bone-200/[0.10]" />
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-bone-500">
            {field.meta.date} · {field.meta.distance ?? '1¼ miles'} · {field.meta.surface ?? 'dirt'}
          </span>
        </div>
        <h1 className="font-display text-5xl italic leading-[1.02] text-bone-100 md:text-[84px]">
          One million
          <br />
          <span className="text-bone-200/80">Derbies, rerun.</span>
        </h1>
        <p className="max-w-2xl text-[15px] leading-relaxed text-bone-400">
          A Monte Carlo model of the 2026 Kentucky Derby. Every slider
          change reruns the simulation and redraws the probability
          distribution over the full 20-horse field. The model is public
          and the math is documented on the{' '}
          <a
            href="/methodology"
            className="text-bone-200 underline decoration-rose decoration-2 underline-offset-4 transition hover:text-rose-glow"
          >
            methodology
          </a>{' '}
          page — so you can argue with it.
        </p>
        {isExample && (
          <div className="inline-flex w-fit items-center gap-3 rounded-sm border border-bone-200/[0.08] bg-ink-850/70 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-bone-500">
            <span className="h-[6px] w-[6px] rounded-full bg-bone-400" />
            Pre-draw · running on {field.horses.length} Derby Trail contenders. Final field lands after the April 25 post draw.
          </div>
        )}
      </section>

      <Simulator field={field.horses} />
    </div>
  );
}
