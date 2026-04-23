import type { Silk as SilkT } from '@/lib/types';

/** Jockey-silk SVG. Inline so it serializes cleanly into PNG exports. */
export function Silk({
  silk,
  size = 18,
  className,
}: {
  silk?: SilkT | null;
  size?: number;
  className?: string;
}) {
  const s = silk ?? { pattern: 'solid', primary: '#8B1A2B', secondary: '#FAF7F2' };
  // Stable id per primary+pattern so the SSR/CSR markup matches and PNG export
  // doesn't drift due to Math.random().
  const id = `silk-${(s.pattern + s.primary).replace(/[^a-z0-9]/gi, '').slice(0, 8)}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      className={className}
      aria-hidden
    >
      <defs>
        <clipPath id={id}>
          <rect x="0" y="0" width="20" height="20" rx="2" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id})`}>
        <rect x="0" y="0" width="20" height="20" fill={s.primary} />
        {s.pattern === 'diamonds' && (
          <g fill={s.secondary}>
            <polygon points="10,2 14,10 10,18 6,10" />
            <polygon points="2,10 6,6 10,10 6,14" opacity="0.6" />
            <polygon points="14,6 18,10 14,14 10,10" opacity="0.6" />
          </g>
        )}
        {s.pattern === 'stripes' && (
          <g fill={s.secondary}>
            <rect x="0" y="4" width="20" height="3" />
            <rect x="0" y="13" width="20" height="3" />
          </g>
        )}
        {s.pattern === 'quartered' && (
          <g fill={s.secondary}>
            <rect x="0" y="0" width="10" height="10" />
            <rect x="10" y="10" width="10" height="10" />
          </g>
        )}
        {s.pattern === 'chevrons' && (
          <g fill={s.secondary}>
            <polygon points="0,6 10,0 20,6 20,10 10,4 0,10" />
            <polygon points="0,14 10,8 20,14 20,18 10,12 0,18" opacity="0.8" />
          </g>
        )}
        {s.pattern === 'hoops' && (
          <g fill="none" stroke={s.secondary} strokeWidth="2.5">
            <circle cx="10" cy="10" r="3" />
            <circle cx="10" cy="10" r="7" opacity="0.6" />
          </g>
        )}
      </g>
      <rect
        x="0.5"
        y="0.5"
        width="19"
        height="19"
        rx="2"
        fill="none"
        stroke="rgba(26,24,20,0.25)"
      />
    </svg>
  );
}
