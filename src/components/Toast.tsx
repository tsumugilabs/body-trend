import { useEffect } from 'react';

export type ToastAction = { label: string; onClick: () => void };

export type ToastMessage = {
  id: number;
  text: string;
  tone?: 'info' | 'error';
  /** 「元に戻す」などの操作ボタン */
  action?: ToastAction;
};

export type Notify = (
  text: string,
  options?: { tone?: 'info' | 'error'; action?: ToastAction },
) => void;

type Props = { toast: ToastMessage | null; onDone: () => void; duration?: number };

export function Toast({ toast, onDone, duration = 2400 }: Props) {
  useEffect(() => {
    if (!toast) return;
    // 操作ボタン付きは押す時間を確保するため長めに表示する
    const ms = toast.action ? 8000 : toast.tone === 'error' ? duration * 2 : duration;
    const timer = window.setTimeout(onDone, ms);
    return () => window.clearTimeout(timer);
  }, [toast, onDone, duration]);

  return (
    <div className="toast-region" role="status" aria-live="polite">
      {toast && (
        <div
          key={toast.id}
          className={`toast ${toast.tone === 'error' ? 'toast-error' : ''} ${toast.action ? 'toast-with-action' : ''}`}
        >
          <span>{toast.text}</span>
          {toast.action && (
            <button
              type="button"
              className="toast-action"
              onClick={() => {
                const action = toast.action;
                // 先に閉じてから実行する（実行側が出す次のメッセージを消さないため）
                onDone();
                action?.onClick();
              }}
            >
              {toast.action.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
