import { useEffect } from 'react';

export type ToastMessage = { id: number; text: string; tone?: 'info' | 'error' };

type Props = { toast: ToastMessage | null; onDone: () => void; duration?: number };

export function Toast({ toast, onDone, duration = 2400 }: Props) {
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(onDone, toast.tone === 'error' ? duration * 2 : duration);
    return () => window.clearTimeout(timer);
  }, [toast, onDone, duration]);

  return (
    <div className="toast-region" role="status" aria-live="polite">
      {toast && (
        <div key={toast.id} className={`toast ${toast.tone === 'error' ? 'toast-error' : ''}`}>
          {toast.text}
        </div>
      )}
    </div>
  );
}
