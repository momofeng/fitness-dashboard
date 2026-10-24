// 瀏覽器平台 API 的薄包裝：每個都要能在不支援的環境安靜退場。

const LS_PREFIX = 'fd:';

/** localStorage 只放個人便利設定（例如上次選的分頁），讀寫失敗不影響功能 */
export const local = {
  get<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(LS_PREFIX + key);
      return raw == null ? fallback : (JSON.parse(raw) as T);
    } catch {
      return fallback;
    }
  },
  set(key: string, value: unknown) {
    try {
      localStorage.setItem(LS_PREFIX + key, JSON.stringify(value));
    } catch {
      /* 私密模式或儲存已滿 */
    }
  },
};

// ---------- 持久儲存 ----------

export type PersistStatus = 'persisted' | 'not-persisted' | 'unsupported';

export async function persistStatus(): Promise<PersistStatus> {
  if (!navigator.storage?.persisted) return 'unsupported';
  try {
    return (await navigator.storage.persisted()) ? 'persisted' : 'not-persisted';
  } catch {
    return 'unsupported';
  }
}

/** 請瀏覽器不要在空間不足時清掉這個 App 的資料 */
export async function requestPersist(): Promise<PersistStatus> {
  if (!navigator.storage?.persist) return 'unsupported';
  try {
    return (await navigator.storage.persist()) ? 'persisted' : 'not-persisted';
  } catch {
    return 'unsupported';
  }
}

export async function storageEstimate(): Promise<{ usage: number; quota: number } | null> {
  try {
    const e = await navigator.storage?.estimate?.();
    return e ? { usage: e.usage ?? 0, quota: e.quota ?? 0 } : null;
  } catch {
    return null;
  }
}

// ---------- 分享或下載檔案 ----------

/**
 * 手機優先用 Web Share 分享檔案（可存到雲端硬碟、LINE、檔案 App），
 * 不支援或使用者取消時改用一般下載。回傳實際採用的方式。
 */
export async function shareOrDownload(blob: Blob, filename: string, title: string): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const file = new File([blob], filename, { type: blob.type || 'application/octet-stream' });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] }) && matchMedia('(pointer: coarse)').matches) {
    try {
      await nav.share({ files: [file], title });
      return 'shared';
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled';
    }
  }
  download(blob, filename);
  return 'downloaded';
}

export function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function readFileText(file: File): Promise<string> {
  return file.text();
}

// ---------- 螢幕保持亮著 ----------

let wakeLock: WakeLockSentinel | null = null;
let wantWake = false;

export async function keepAwake(on: boolean) {
  wantWake = on;
  if (!('wakeLock' in navigator)) return;
  try {
    if (on && !wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => {
        wakeLock = null;
      });
    } else if (!on && wakeLock) {
      await wakeLock.release();
      wakeLock = null;
    }
  } catch {
    wakeLock = null;
  }
}

// 切到背景時瀏覽器會自動釋放，回到前景要重新取得
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && wantWake && !wakeLock) void keepAwake(true);
  });
}

// ---------- 音效與震動 ----------

let audioCtx: AudioContext | null = null;

/** 必須在使用者點擊時呼叫一次（例如按下「開始訓練」），之後才能自動播放提示音 */
export function unlockAudio() {
  try {
    audioCtx ??= new AudioContext();
    if (audioCtx.state === 'suspended') void audioCtx.resume();
  } catch {
    audioCtx = null;
  }
}

/** 三短音的提示聲 */
export function beep() {
  if (!audioCtx) return;
  try {
    const t0 = audioCtx.currentTime;
    for (let i = 0; i < 3; i++) {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = i === 2 ? 1175 : 880;
      const start = t0 + i * 0.22;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.35, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.18);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(start);
      osc.stop(start + 0.2);
    }
  } catch {
    /* 音效失敗不影響功能 */
  }
}

export function vibrate(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* iOS 不支援 */
  }
}

// ---------- 通知（休息結束時 App 在背景） ----------

export function notificationPermission(): NotificationPermission | 'unsupported' {
  return typeof Notification === 'undefined' ? 'unsupported' : Notification.permission;
}

export async function requestNotification(): Promise<NotificationPermission | 'unsupported'> {
  if (typeof Notification === 'undefined') return 'unsupported';
  try {
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
}

export async function notify(title: string, body: string) {
  if (notificationPermission() !== 'granted') return;
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) await reg.showNotification(title, { body, tag: 'rest-timer', icon: `${import.meta.env.BASE_URL}icons/icon-192.png` });
    else new Notification(title, { body });
  } catch {
    /* 背景通知失敗時，回到前景仍會震動與響鈴 */
  }
}

export function isStandalone(): boolean {
  return matchMedia('(display-mode: standalone)').matches;
}
