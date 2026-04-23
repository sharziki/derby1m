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
        ink: {
          950: '#07090F',
          900: '#0A0E17',
          850: '#0E131F',
          800: '#121826',
          700: '#1A2134',
          600: '#242D45',
          500: '#2A3246',
        },
        bone: {
          50: '#FAF6EC',
          100: '#F1EADB',
          200: '#EDE6D3',
          300: '#D8CFBB',
          400: '#9AA3B8',
          500: '#6B7490',
          600: '#4A536B',
        },
        rose: {
          DEFAULT: '#B4342D',
          dim: '#7A2620',
          deep: '#5A1B17',
          glow: '#D96056',
        },
      },
      fontFamily: {
        display: ['var(--font-display)', 'Cormorant Garamond', 'serif'],
        sans: ['var(--font-sans)', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        micro: ['10px', { lineHeight: '1.4', letterSpacing: '0.18em' }],
      },
      boxShadow: {
        hairline: 'inset 0 0 0 1px rgba(237, 230, 211, 0.08)',
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
    },
  },
  plugins: [],
};

export default config;
