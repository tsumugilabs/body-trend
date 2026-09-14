import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

export type ConfirmOptions = {
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** 削除などの取り返しにくい操作 */
  danger?: boolean;
  /** 指定した文字を入力するまで実行ボタンを押せないようにする */
  requireText?: string;
};

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn>(() => Promise.resolve(false));

type Pending = ConfirmOptions & { resolve: (ok: boolean) => void };

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const [typed, setTyped] = useState('');

  const confirm = useCallback<ConfirmFn>(
    (options) =>
      new Promise<boolean>((resolve) => {
        setTyped('');
        setPending({ ...options, resolve });
      }),
    [],
  );

  const close = useCallback(
    (ok: boolean) => {
      pending?.resolve(ok);
      setPending(null);
    },
    [pending],
  );

  useEffect(() => {
    if (!pending) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pending, close]);

  const needsText = pending?.requireText !== undefined;
  const canConfirm = !needsText || typed.trim() === pending?.requireText;

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending && (
        <div className="dialog-backdrop" onClick={() => close(false)}>
          <div
            className={`dialog ${pending.danger ? 'dialog-danger' : ''}`}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="confirm-title" className="dialog-title">
              {pending.title}
            </h2>
            {pending.message && <div className="dialog-message">{pending.message}</div>}
            {needsText && (
              <div className="field">
                <label htmlFor="confirm-text" className="field-label">
                  確認のため「{pending.requireText}」と入力してください
                </label>
                <input
                  id="confirm-text"
                  className="text-input"
                  type="text"
                  autoComplete="off"
                  autoCapitalize="off"
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  autoFocus
                />
              </div>
            )}
            <div className="dialog-actions">
              {/* 危険な操作では、うっかり実行しないよう「キャンセル」に初期フォーカスを置く */}
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => close(false)}
                autoFocus={!needsText && pending.danger}
              >
                {pending.cancelLabel ?? 'キャンセル'}
              </button>
              <button
                type="button"
                className={`btn ${pending.danger ? 'btn-danger' : 'btn-primary'}`}
                disabled={!canConfirm}
                onClick={() => canConfirm && close(true)}
                autoFocus={!needsText && !pending.danger}
              >
                {pending.confirmLabel ?? 'OK'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  return useContext(ConfirmContext);
}
