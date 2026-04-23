import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx,mdx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Paper / cream backgrounds
        paper: {
          50: '#FAF7F2',   // bg-primary
          100: '#F3EFE8',  // bg-secondary (cards, panels)
          200: '#EBE5DB',  // bg-tertiary (borders, dividers, rules)
          300: '#DCD3C3',  // hover surfaces, deeper rules
        },
        // Ink — for text. Lower numbers are lighter (subdued), higher are darker.
        ink: {
          400: '#9A958B',  // disabled / very low contrast
          500: '#7A756C',  // captions, metadata
          600: '#4A453E',  // muted body
          800: '#2A2620',  // strong body
          900: '#1A1814',  // headlines, primary text
        },
        // Rose — primary brand accent. "deep" for actions, "mid" for chart, "light" for tints.
        rose: {
          deep: '#8B1A2B',
          mid: '#B83A4E',
          light: '#E8BCC4',
          tint: '#F5DCE0',  // very pale for hover
        },
        gold: {
          DEFAULT: '#9C7B3A',
          dim: '#7A6030',
        },
        signal: {
          green: '#3A6B4A',
          red: '#8B3A3A',
        },
      },
      fontFamily: {
        display: ['var(--font-display)', 'Newsreader', 'Georgia', 'serif'],
        serif: ['var(--font-serif)', 'Newsreader', 'Georgia', 'serif'],
        sans: ['var(--font-sans)', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        micro: ['10px', { lineHeight: '1.4', letterSpacing: '0.16em' }],
      },
      boxShadow: {
        hairline: 'inset 0 0 0 1px #EBE5DB',
        rule: '0 1px 0 #EBE5DB',
      },
      keyframes: {
        pulseSoft: {
          '0%, 100%': { opacity: '0.45' },
          '50%': { opacity: '1' },
        },
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        pulseSoft: 'pulseSoft 1.8s ease-in-out infinite',
        shimmer: 'shimmer 1.4s ease-in-out infinite',
      },
      containers: {
        chart: '38rem',
      },
    },
  },
  plugins: [require('@tailwindcss/container-queries')],
};

export default config;
