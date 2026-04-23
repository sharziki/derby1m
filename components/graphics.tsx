/**
 * Decorative + diagrammatic SVGs. Pure presentation, no data.
 * All graphics use brand tokens (rose-deep, ink, paper) so they read as
 * one family across the site.
 */

const ROSE = '#8B1A2B';
const ROSE_MID = '#B83A4E';
const ROSE_LIGHT = '#E8BCC4';
const INK = '#1A1814';
const INK_MUTE = '#4A453E';
const INK_LOW = '#7A756C';
const PAPER_RULE = '#EBE5DB';

/** Brand horseshoe, 24px default. Stroked outline + 7 nail dots. */
export function Horseshoe({
  size = 22,
  color = ROSE,
  className,
}: {
  size?: number;
  color?: string;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden
    >
      <path
        d="M5 3 C5 13.5, 7.5 19.5, 12 19.5 C16.5 19.5, 19 13.5, 19 3
           L16.5 3 C16.5 11.5, 14.6 17.2, 12 17.2 C9.4 17.2, 7.5 11.5, 7.5 3 Z"
        fill={color}
        opacity={0.92}
      />
      {/* nail dots */}
      {[
        [7.6, 5.5],
        [7.0, 9.0],
        [7.0, 12.5],
        [12, 18.4],
        [17.0, 12.5],
        [17.0, 9.0],
        [16.4, 5.5],
      ].map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r={0.55} fill={PAPER_RULE} />
      ))}
    </svg>
  );
}

/** Decorative editorial rule with a centered glyph. */
export function RoseRule({ className }: { className?: string }) {
  return (
    <div className={`flex items-center gap-3 ${className ?? ''}`}>
      <span className="h-px flex-1 bg-paper-200" />
      <Horseshoe size={14} color={ROSE} />
      <span className="h-px flex-1 bg-paper-200" />
    </div>
  );
}

/**
 * Mini track oval for the post-position section. 20 starting gates arranged
 * along the chute (top edge), shaded by relative win-rate weight.
 */
export function TrackOval({
  weights,
  width = 480,
}: {
  /** length-20 array of weights in [0,1]; higher = better historical win rate */
  weights: number[];
  width?: number;
}) {
  const height = Math.round(width * 0.42);
  const cx = width / 2;
  const cy = height / 2;
  const rx = width / 2 - 18;
  const ry = height / 2 - 18;
  // Place gates evenly along the top arc, indexed by post position 1..20.
  const n = weights.length;
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height="auto"
      role="img"
      aria-label="Schematic Derby track with starting gates 1 through 20, shaded by historical win rate"
      className="block"
    >
      {/* Outer rail */}
      <ellipse
        cx={cx}
        cy={cy}
        rx={rx}
        ry={ry}
        fill="none"
        stroke={PAPER_RULE}
        strokeWidth={1.5}
      />
      {/* Inner rail */}
      <ellipse
        cx={cx}
        cy={cy}
        rx={rx - 26}
        ry={ry - 16}
        fill="none"
        stroke={PAPER_RULE}
        strokeWidth={1.2}
      />
      {/* Finish line / chute mark */}
      <line
        x1={cx + 4}
        x2={cx + 4}
        y1={cy - ry}
        y2={cy - ry + 14}
        stroke={ROSE}
        strokeWidth={2}
      />
      {/* Gates along the chute (top arc, slightly inside the rail) */}
      {weights.map((w, i) => {
        // Spread evenly along top arc from theta=180+12° to theta=360-12°
        const t = i / Math.max(n - 1, 1);
        const theta = Math.PI + 0.18 + (Math.PI - 0.36) * t; // top half
        const x = cx + (rx - 13) * Math.cos(theta);
        const y = cy + (ry - 9) * Math.sin(theta);
        const fill = weightFill(w);
        return (
          <g key={i}>
            <rect
              x={x - 6}
              y={y - 5.5}
              width={12}
              height={11}
              rx={1.5}
              fill={fill}
              stroke={INK_MUTE}
              strokeWidth={0.6}
            />
            <text
              x={x}
              y={y + 2.6}
              textAnchor="middle"
              fontSize={8}
              fontFamily="JetBrains Mono, monospace"
              fill={w > 0.55 ? '#FAF7F2' : INK}
            >
              {i + 1}
            </text>
          </g>
        );
      })}
      {/* Legend */}
      <g transform={`translate(18, ${height - 22})`}>
        <text
          x={0}
          y={-4}
          fontSize={9}
          fontFamily="JetBrains Mono, monospace"
          fill={INK_LOW}
        >
          historical win-rate weight
        </text>
        <rect x={0} y={0} width={14} height={8} fill={ROSE_LIGHT} stroke={INK_MUTE} strokeWidth={0.5} />
        <text x={18} y={7} fontSize={8} fontFamily="JetBrains Mono, monospace" fill={INK_MUTE}>
          low
        </text>
        <rect x={48} y={0} width={14} height={8} fill={ROSE_MID} stroke={INK_MUTE} strokeWidth={0.5} />
        <text x={66} y={7} fontSize={8} fontFamily="JetBrains Mono, monospace" fill={INK_MUTE}>
          mid
        </text>
        <rect x={94} y={0} width={14} height={8} fill={ROSE} stroke={INK_MUTE} strokeWidth={0.5} />
        <text x={112} y={7} fontSize={8} fontFamily="JetBrains Mono, monospace" fill={INK_MUTE}>
          high
        </text>
      </g>
    </svg>
  );
}

function weightFill(w: number): string {
  if (w >= 0.66) return ROSE;
  if (w >= 0.42) return ROSE_MID;
  if (w >= 0.18) return ROSE_LIGHT;
  return PAPER_RULE;
}

/**
 * 4-dot field strip showing where each running style sits in the early pace.
 * E = front, E/P = front-mid, P = mid, S = back. Reading left→right = lead→tail.
 */
export function PacePosition({
  style,
  size = 56,
}: {
  style: 'E' | 'E/P' | 'P' | 'S';
  size?: number;
}) {
  const idx = style === 'E' ? 0 : style === 'E/P' ? 1 : style === 'P' ? 2 : 3;
  return (
    <svg
      width={size}
      height={size * 0.32}
      viewBox="0 0 56 18"
      role="img"
      aria-label={`Running style ${style}: position ${idx + 1} of 4 in early pace`}
    >
      <line x1={4} x2={52} y1={9} y2={9} stroke={PAPER_RULE} strokeWidth={1} />
      {[0, 1, 2, 3].map((i) => {
        const cx = 8 + i * 13;
        const active = i === idx;
        return (
          <circle
            key={i}
            cx={cx}
            cy={9}
            r={active ? 4 : 2}
            fill={active ? ROSE : 'none'}
            stroke={active ? ROSE : INK_LOW}
            strokeWidth={1.2}
          />
        );
      })}
    </svg>
  );
}

/**
 * Tiny inline distribution bar for prose — fixed gradient, no data.
 * Visualizes the "saturated rose at P(1st), fading to nothing at the tail"
 * concept inside the text.
 */
export function DistroSparkle({ width = 160 }: { width?: number }) {
  return (
    <svg
      width={width}
      height={12}
      viewBox={`0 0 ${width} 12`}
      role="img"
      aria-label="Sample finish distribution: rose at left, fading toward the tail"
      className="inline-block align-middle"
    >
      <defs>
        <linearGradient id="distro-spark" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor={ROSE} />
          <stop offset="0.18" stopColor={ROSE_MID} />
          <stop offset="0.4" stopColor={ROSE_LIGHT} />
          <stop offset="1" stopColor={PAPER_RULE} />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width={width} height="12" fill="url(#distro-spark)" rx="2" />
    </svg>
  );
}

/**
 * Schematic of one Monte Carlo iteration: 5 horses, each as a Normal curve,
 * a vertical "draw" line, and a 1st-place callout. Used in the methodology
 * "The simulation" section.
 */
export function IterationDiagram({ width = 560 }: { width?: number }) {
  const height = 180;
  // 5 horses with varying means and widths
  const horses = [
    { name: 'A', mean: 100, std: 6, color: ROSE },
    { name: 'B', mean: 95, std: 8, color: ROSE_MID },
    { name: 'C', mean: 92, std: 5, color: ROSE_LIGHT },
    { name: 'D', mean: 88, std: 7, color: INK_LOW },
    { name: 'E', mean: 84, std: 6, color: INK_MUTE },
  ];
  // X domain: roughly 70..115 Beyer
  const xMin = 70;
  const xMax = 115;
  const xScale = (v: number) => ((v - xMin) / (xMax - xMin)) * (width - 60) + 40;
  const yBase = height - 38;
  // Draws (one per horse) — fixed positions for repeatable graphic
  const draws = [104, 92, 96, 86, 88];
  const winnerIdx = draws.indexOf(Math.max(...draws));
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height="auto"
      role="img"
      aria-label="A single Monte Carlo iteration: each horse drawn from its own Normal distribution; the highest sample wins"
    >
      {/* X axis */}
      <line x1={20} x2={width - 20} y1={yBase} y2={yBase} stroke={PAPER_RULE} strokeWidth={1} />
      <text x={20} y={height - 20} fontSize={10} fontFamily="JetBrains Mono, monospace" fill={INK_LOW}>
        Beyer →
      </text>
      <text x={xScale(85)} y={yBase + 14} fontSize={10} fontFamily="JetBrains Mono, monospace" fill={INK_LOW}>
        85
      </text>
      <text x={xScale(100)} y={yBase + 14} fontSize={10} fontFamily="JetBrains Mono, monospace" fill={INK_LOW}>
        100
      </text>
      {/* Curves + draws */}
      {horses.map((h, i) => {
        // Draw a Gaussian curve approximation as a quadratic bump centered at mean.
        const points: [number, number][] = [];
        for (let v = xMin; v <= xMax; v += 1) {
          const z = (v - h.mean) / h.std;
          const yProb = Math.exp(-0.5 * z * z);
          points.push([xScale(v), yBase - yProb * 32]);
        }
        const d = points
          .map((p, j) => `${j === 0 ? 'M' : 'L'} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`)
          .join(' ');
        return (
          <g key={h.name}>
            <path d={d} stroke={h.color} strokeWidth={1.2} fill="none" opacity={0.9} />
            {/* Draw marker */}
            <circle
              cx={xScale(draws[i])}
              cy={yBase}
              r={i === winnerIdx ? 4 : 3}
              fill={i === winnerIdx ? ROSE : h.color}
              stroke={INK}
              strokeWidth={i === winnerIdx ? 1 : 0}
            />
            <line
              x1={xScale(draws[i])}
              x2={xScale(draws[i])}
              y1={yBase}
              y2={yBase - 2}
              stroke={i === winnerIdx ? ROSE : INK_LOW}
              strokeWidth={1}
            />
            <text
              x={20}
              y={yBase - 36 - i * 18}
              fontSize={11}
              fontFamily="Newsreader, Georgia, serif"
              fontStyle="italic"
              fill={INK_MUTE}
            >
              {h.name}
            </text>
            <text
              x={32}
              y={yBase - 36 - i * 18}
              fontSize={10}
              fontFamily="JetBrains Mono, monospace"
              fill={INK_LOW}
            >
              μ={h.mean} σ={h.std}
            </text>
          </g>
        );
      })}
      {/* Winner callout */}
      <g>
        <line
          x1={xScale(draws[winnerIdx])}
          x2={xScale(draws[winnerIdx])}
          y1={yBase - 60}
          y2={yBase - 6}
          stroke={ROSE}
          strokeWidth={1}
          strokeDasharray="3 2"
        />
        <text
          x={xScale(draws[winnerIdx]) + 6}
          y={yBase - 64}
          fontSize={10}
          fontFamily="JetBrains Mono, monospace"
          fill={ROSE}
        >
          highest draw → 1st
        </text>
      </g>
    </svg>
  );
}
