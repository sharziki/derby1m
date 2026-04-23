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
  const [err, setErr] = useState<string | null>(null);

  const onClick = async () => {
    const el = targetRef.current;
    if (!el) return;
    setBusy(true);
    setErr(null);
    try {
      // Render twice — Safari/WebKit sometimes returns a blank PNG on the
      // first call when fonts have just loaded. The second call always
      // hits a warm cache.
      await toPng(el, {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: '#FAF7F2',
        width: 1080,
        height: 1080,
      });
      const dataUrl = await toPng(el, {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: '#FAF7F2',
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
      setErr('Export failed — try again');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        className={cn(
          'inline-flex min-h-[44px] items-center gap-2 rounded-sm bg-rose-deep px-4 py-2.5',
          'font-mono text-[11px] uppercase tracking-[0.14em] text-paper-50',
          'transition hover:bg-rose-mid disabled:opacity-50',
        )}
      >
        {busy ? (
          <Loader2 size={13} className="animate-spin" />
        ) : (
          <Download size={13} />
        )}
        Share PNG
      </button>
      {err && (
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-signal-red">
          {err}
        </span>
      )}
    </div>
  );
}
