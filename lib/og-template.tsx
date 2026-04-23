/* eslint-disable @next/next/no-img-element */
import { loadField } from '@/lib/field';
import { SITE_HOST } from '@/lib/site-url';

const SIZE = { width: 1200, height: 630 };

const COLORS = {
  paper: '#FAF7F2',
  paperRule: '#EBE5DB',
  ink: '#1A1814',
  inkMute: '#4A453E',
  inkLow: '#7A756C',
  rose: '#8B1A2B',
  roseMid: '#B83A4E',
  roseLight: '#E8BCC4',
  roseTail: '#D2D0CC',
};

/**
 * Satori (the engine inside @vercel/og) needs TTF/OTF, not WOFF2.
 * Google Fonts CSS only serves WOFF2 to modern UA strings, so we skip
 * the custom-font path and let the layout fall back to system serif.
 * If you want exact Newsreader rendering in the OG, drop a .ttf in
 * /public/fonts/ and load it via fs.readFile here.
 */
async function fetchSerif(): Promise<{ name: string; data: ArrayBuffer; weight: number; style: 'italic' | 'normal' }[]> {
  return [];
}

interface TopHorse {
  name: string;
  ml: string | null;
  width: number; // 0..1
}

async function topHorses(): Promise<TopHorse[]> {
  // OG render must not depend on the simulator (cold-start risk, recursive call).
  // Use a deterministic stand-in: top horses by (max beyer + class_rating).
  // This is a presentation surface, not the real probabilities — just a hint.
  try {
    const field = await loadField();
    const ranked = field.horses
      .map((h) => ({
        name: h.name,
        ml: h.morning_line ?? null,
        score:
          Math.max(...h.beyer_last_3) + h.class_rating + (h.surface_aptitude_dirt - 0.5) * 3,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
    const max = ranked[0]?.score ?? 1;
    const min = ranked[ranked.length - 1]?.score ?? 0;
    const span = Math.max(max - min, 1);
    return ranked.map((h) => ({
      name: h.name,
      ml: h.ml,
      width: 0.45 + ((h.score - min) / span) * 0.55, // 0.45..1.0
    }));
  } catch {
    return [];
  }
}

export async function buildOgImage() {
  const { ImageResponse } = await import('next/og');
  const [fonts, top] = await Promise.all([fetchSerif(), topHorses()]);

  const serifStack =
    fonts.length > 0 ? '"Newsreader", Georgia, serif' : 'Georgia, "Times New Roman", serif';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: COLORS.paper,
          padding: '60px 72px',
          fontFamily:
            '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
          color: COLORS.ink,
        }}
      >
        {/* Top rose hairline */}
        <div
          style={{
            display: 'flex',
            height: '4px',
            width: '100%',
            background: COLORS.rose,
            marginBottom: 32,
          }}
        />

        {/* Wordmark + meta */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <span
              style={{
                fontFamily: '"JetBrains Mono", ui-monospace, monospace',
                fontSize: 22,
                letterSpacing: '0.32em',
                textTransform: 'uppercase',
                color: COLORS.inkLow,
              }}
            >
              Derby
            </span>
            <span
              style={{
                fontFamily: serifStack,
                fontSize: 96,
                fontStyle: 'italic',
                fontWeight: 500,
                lineHeight: 1,
                color: COLORS.ink,
              }}
            >
              /1M
            </span>
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
              fontFamily: '"JetBrains Mono", ui-monospace, monospace',
              fontSize: 14,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: COLORS.inkMute,
              gap: 4,
            }}
          >
            <span>152nd Kentucky Derby</span>
            <span style={{ color: COLORS.inkLow }}>May 2, 2026 · 1¼ miles</span>
          </div>
        </div>

        {/* Tagline */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            marginTop: 36,
            paddingTop: 20,
            borderTop: `1px solid ${COLORS.paperRule}`,
          }}
        >
          <span
            style={{
              fontFamily: serifStack,
              fontSize: 64,
              fontStyle: 'italic',
              fontWeight: 500,
              lineHeight: 1.05,
              color: COLORS.ink,
              maxWidth: 900,
            }}
          >
            One million Derbies, rerun.
          </span>
          <span
            style={{
              marginTop: 14,
              fontFamily: '"JetBrains Mono", ui-monospace, monospace',
              fontSize: 16,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: COLORS.inkLow,
            }}
          >
            Monte Carlo simulation · open source
          </span>
        </div>

        {/* Top contenders preview */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            marginTop: 'auto',
            gap: 6,
          }}
        >
          {top.length > 0 && (
            <span
              style={{
                fontFamily: '"JetBrains Mono", ui-monospace, monospace',
                fontSize: 12,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: COLORS.inkLow,
                marginBottom: 6,
              }}
            >
              Sample contenders · pre-draw projection
            </span>
          )}
          {top.map((h, i) => (
            <div
              key={h.name}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                paddingBottom: 6,
                borderBottom: i < top.length - 1 ? `1px solid ${COLORS.paperRule}` : 'none',
              }}
            >
              <span
                style={{
                  fontFamily: serifStack,
                  fontStyle: 'italic',
                  fontWeight: 500,
                  fontSize: 26,
                  color: COLORS.ink,
                  width: 260,
                }}
              >
                {h.name}
              </span>
              <div
                style={{
                  display: 'flex',
                  flex: 1,
                  height: 14,
                  background: COLORS.paperRule,
                  borderRadius: 2,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${h.width * 100}%`,
                    background: i === 0 ? COLORS.rose : i === 1 ? COLORS.roseMid : COLORS.roseLight,
                    height: '100%',
                  }}
                />
              </div>
              <span
                style={{
                  fontFamily: '"JetBrains Mono", ui-monospace, monospace',
                  fontSize: 14,
                  color: COLORS.inkMute,
                  width: 64,
                  textAlign: 'right',
                }}
              >
                {h.ml ?? '—'}
              </span>
            </div>
          ))}
        </div>

        {/* Bottom watermark */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 28,
            paddingTop: 18,
            borderTop: `1px solid ${COLORS.paperRule}`,
            fontFamily: '"JetBrains Mono", ui-monospace, monospace',
            fontSize: 13,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: COLORS.inkLow,
          }}
        >
          <span>{SITE_HOST}</span>
          <span>Display only · No wagering</span>
        </div>
      </div>
    ),
    {
      ...SIZE,
      fonts: fonts.length
        ? fonts.map((f) => ({
            name: f.name,
            data: f.data,
            weight: f.weight as 400 | 500 | 600 | 700,
            style: f.style,
          }))
        : undefined,
    },
  );
}

export const ogSize = SIZE;
