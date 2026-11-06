import React, { useEffect, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { CheckCircle2, X } from 'lucide-react';
import { portalContainer } from '@/lib/host';

/** One small toast at the bottom of the screen ("Added to your cart · View cart"), shared by every block. */
type Note = { id: number; text: string; action?: { label: string; href: string } };
let root: Root | null = null;
let push: ((n: Note) => void) | null = null;
let seq = 0;

function Toaster() {
  const [note, setNote] = useState<Note | null>(null);
  useEffect(() => {
    push = setNote;
    return () => {
      push = null;
    };
  }, []);
  useEffect(() => {
    if (!note) return;
    const t = window.setTimeout(() => setNote(null), 5000);
    return () => window.clearTimeout(t);
  }, [note]);
  if (!note) return null;
  return (
    <div className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4" role="status" aria-live="polite">
      <div className="ecom-sf-toast flex max-w-md items-center gap-3 rounded-2xl border bg-popover px-4 py-3 text-sm text-popover-foreground shadow-lg">
        <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden="true" />
        <span className="flex-1">{note.text}</span>
        {note.action && (
          <a className="font-medium underline underline-offset-4" href={note.action.href}>
            {note.action.label}
          </a>
        )}
        <button type="button" className="cursor-pointer text-muted-foreground hover:text-foreground" onClick={() => setNote(null)} aria-label="Dismiss">
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}

export function notify(text: string, action?: Note['action']) {
  const host = portalContainer() ?? document.body;
  if (!root) {
    const el = document.createElement('div');
    host.appendChild(el);
    root = createRoot(el);
    root.render(<Toaster />);
  }
  const note = { id: ++seq, text, action };
  // The toaster subscribes on its first render; retry once on the next frame.
  if (push) push(note);
  else requestAnimationFrame(() => push?.(note));
}
