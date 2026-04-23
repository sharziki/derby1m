'use client';

import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { toPng } from 'html-to-image';
import { cn } from '@/lib/utils';

export function ShareButton({
  targetRef,
  filename = 'derby1m.png',
}: {
  targetRef: React.RefObject<HTMLElement | null>;
  filename?: string;
}) {
  const [busy, setBusy] = useState(false);

  const onClick = async () => {
    const el = targetRef.current;
    if (!el) return;
    setBusy(true);
    try {
      const dataUrl = await toPng(el, {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: '#07090F',
        width: 1080,
        height: 1080,
        style: { width: '1080px', height: '1080px' },
      });
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = filename;
      a.click();
    } catch (e) {
      console.error('[share] export failed', e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={cn(
        'inline-flex items-center gap-2 rounded-sm border border-bone-200/[0.14] bg-ink-850/60 px-4 py-2',
        'font-mono text-[11px] uppercase tracking-[0.16em] text-bone-200',
        'transition hover:border-rose/70 hover:bg-rose/[0.08] hover:text-rose-glow',
        'disabled:opacity-50',
      )}
    >
      {busy ? (
        <Loader2 size={13} className="animate-spin" />
      ) : (
        <Download size={13} />
      )}
      Share 1080²
    </button>
  );
}
