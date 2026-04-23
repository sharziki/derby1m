'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

const EASE = 'power3.out';

/** Fades up the direct children of this wrapper in sequence, on mount. */
export function RevealStagger({
  children,
  delay = 0,
  stagger = 0.08,
  y = 14,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  stagger?: number;
  y?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const targets = Array.from(el.children) as HTMLElement[];
    if (!targets.length) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        targets,
        { autoAlpha: 0, y },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.7,
          ease: EASE,
          stagger,
          delay,
        },
      );
    }, el);
    return () => ctx.revert();
  }, [delay, stagger, y]);

  return (
    <div ref={ref} className={className} style={{ display: 'contents' }}>
      {children}
    </div>
  );
}

/** Fades up its content when scrolled into view. Idempotent — fires once. */
export function RevealOnScroll({
  children,
  y = 18,
  className,
}: {
  children: React.ReactNode;
  y?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        el,
        { autoAlpha: 0, y },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.8,
          ease: EASE,
          scrollTrigger: {
            trigger: el,
            start: 'top 88%',
            once: true,
          },
        },
      );
    }, el);
    return () => ctx.revert();
  }, [y]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
