import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { defaultSettings } from '../defaults';
import type { Settings } from '../schemas';

export async function getSettings(): Promise<Settings> {
  const s = await db.settings.get('app');
  if (s) return s;
  const fresh = defaultSettings(Date.now());
  await db.settings.put(fresh);
  return fresh;
}

type DeepPartial<T> = { [K in keyof T]?: T[K] extends Array<unknown> ? T[K] : T[K] extends object ? DeepPartial<T[K]> : T[K] };

function merge<T>(base: T, patch: DeepPartial<T>): T {
  const out = { ...base } as Record<string, unknown>;
  for (const [k, v] of Object.entries(patch as Record<string, unknown>)) {
    if (v === undefined) continue;
    const cur = out[k];
    out[k] =
      v && typeof v === 'object' && !Array.isArray(v) && cur && typeof cur === 'object' && !Array.isArray(cur)
        ? merge(cur, v as DeepPartial<typeof cur>)
        : v;
  }
  return out as T;
}

export async function updateSettings(patch: DeepPartial<Settings>): Promise<Settings> {
  return db.transaction('rw', db.settings, async () => {
    const cur = await getSettings();
    const next = merge(cur, patch);
    next.updatedAt = Date.now();
    await db.settings.put(next);
    return next;
  });
}

/** undefined = 還在讀取；之後一定有值（第一次讀取時會建立預設設定） */
export function useSettings(): Settings | undefined {
  return useLiveQuery(async () => (await db.settings.get('app')) ?? defaultSettings(0), []);
}
