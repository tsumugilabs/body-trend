export type Platform = 'ios' | 'android' | 'other';

export type ProtectionStatus = {
  /** navigator.storage.persist が使えるか */
  supported: boolean;
  /** ブラウザが自動削除しない保存領域として扱っているか */
  persisted: boolean;
  /** ホーム画面から（アプリとして）起動しているか */
  standalone: boolean;
  platform: Platform;
};

export function isStandalone(): boolean {
  const media =
    typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches;
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return media || iosStandalone;
}

export function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'other';
}

export async function getProtectionStatus(): Promise<ProtectionStatus> {
  const base = { standalone: isStandalone(), platform: detectPlatform() };
  try {
    if (!navigator.storage?.persisted) return { ...base, supported: false, persisted: false };
    return { ...base, supported: true, persisted: await navigator.storage.persisted() };
  } catch {
    return { ...base, supported: false, persisted: false };
  }
}

/** ブラウザに保存データを自動削除しないよう依頼する（許可されるかはブラウザ次第） */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
