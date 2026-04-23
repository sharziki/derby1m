import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format a probability as a percent with the given decimal precision. */
export function pct(p: number, digits = 1): string {
  return `${(p * 100).toFixed(digits)}%`;
}

/** Format morning-line odds "5-1" into a compact display. Returns '—' if blank. */
export function fmtML(ml: string | null | undefined): string {
  if (!ml) return '—';
  return ml.replace('/', '-');
}

/** Convert morning-line odds into an implied probability (ignoring overround). */
export function mlToProb(ml: string | null | undefined): number | null {
  if (!ml) return null;
  const parts = ml.replace('/', '-').split('-');
  if (parts.length !== 2) return null;
  const a = Number(parts[0]);
  const b = Number(parts[1]);
  if (!Number.isFinite(a) || !Number.isFinite(b) || a + b <= 0) return null;
  return b / (a + b);
}

/** Format Δ Market as a signed percentage-point string. `null` when no ML. */
export function fmtDeltaMarket(
  model_p_win: number,
  ml: string | null | undefined,
): { text: string; sign: 'pos' | 'neg' | 'neutral' } | null {
  const mp = mlToProb(ml);
  if (mp === null) return null;
  const deltaPp = (model_p_win - mp) * 100;
  const sign = deltaPp > 1 ? 'pos' : deltaPp < -1 ? 'neg' : 'neutral';
  const text = `${deltaPp > 0 ? '+' : ''}${deltaPp.toFixed(1)}pp`;
  return { text, sign };
}
