export type SaveOutcome = 'shared' | 'downloaded' | 'cancelled';

const MAX_BACKUP_BYTES = 5 * 1024 * 1024;

/**
 * テキストファイルを端末に保存する。
 * スマートフォンでは共有シート（「ファイルに保存」など）を使い、使えない場合はダウンロードする。
 */
export async function saveTextFile(text: string, filename: string): Promise<SaveOutcome> {
  const file = new File([text], filename, { type: 'application/json' });
  const coarsePointer =
    typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;

  if (coarsePointer && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'からだ記録のバックアップ' });
      return 'shared';
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled';
      // 共有に失敗したらダウンロードに切り替える
    }
  }

  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'downloaded';
}

export async function readTextFile(file: Blob): Promise<string> {
  if (file.size > MAX_BACKUP_BYTES) throw new Error('file too large');
  if (typeof file.text === 'function') return file.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}
