import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { EXERCISES, getBuiltinExercise } from '../../content';
import type { Exercise } from '../../content/types';
import { db, newId } from '../db';
import { inRange } from '../limits';
import type { CustomExercise, ExercisePref } from '../schemas';

export type AnyExercise = Exercise & { isCustom?: boolean };

export function toExercise(c: CustomExercise): AnyExercise {
  const { updatedAt: _u, ...rest } = c;
  return { ...rest, isCustom: true };
}

/** 內建＋自建動作的查詢表 */
export function useExerciseLookup(): { all: AnyExercise[]; get: (id: string) => AnyExercise | undefined; ready: boolean } {
  const custom = useLiveQuery(() => db.exercisesCustom.toArray(), []);
  return useMemo(() => {
    const extra = (custom ?? []).map(toExercise);
    const map = new Map<string, AnyExercise>(extra.map((e) => [e.id, e]));
    return {
      all: [...EXERCISES, ...extra],
      get: (id: string) => getBuiltinExercise(id) ?? map.get(id),
      ready: custom !== undefined,
    };
  }, [custom]);
}

export async function loadExerciseLookup(): Promise<(id: string) => AnyExercise | undefined> {
  const extra = (await db.exercisesCustom.toArray()).map(toExercise);
  const map = new Map(extra.map((e) => [e.id, e]));
  return (id) => getBuiltinExercise(id) ?? map.get(id);
}

export function exerciseName(get: (id: string) => AnyExercise | undefined, id: string): string {
  return get(id)?.nameZh ?? '（已刪除的動作）';
}

export type PrefPatch = Partial<Omit<ExercisePref, 'exerciseId' | 'updatedAt'>>;

/** 寫入前檢查範圍；值為 undefined 的欄位會被移除（回到課表預設） */
export function validatePref(p: PrefPatch): string | null {
  const int = (v: number | undefined, lo: number, hi: number) => v == null || (Number.isInteger(v) && v >= lo && v <= hi);
  if (!int(p.repMin, 1, 100) || !int(p.repMax, 1, 100)) return '次數請輸入 1–100 的整數';
  if (p.repMin != null && p.repMax != null && p.repMin > p.repMax) return '次數下限不能大於上限';
  if (!int(p.restSec, 0, 900)) return '休息請輸入 0–900 秒';
  if (p.incrementKg != null && !(p.incrementKg >= 0 && p.incrementKg <= 20)) return '加重量請輸入 0–20 kg';
  if (p.context) {
    const c = p.context;
    if (c.step != null && !inRange('machineStep', c.step)) return '每格重量須介於 0.1–100';
    if ((c.machine?.length ?? 0) > 60 || (c.seat?.length ?? 0) > 60 || (c.grip?.length ?? 0) > 80 || (c.reminder?.length ?? 0) > 500) return '器械設定文字太長';
  }
  if (p.note != null && p.note.length > 500) return '備註最多 500 字';
  return null;
}

export async function saveExercisePref(exerciseId: string, patch: PrefPatch) {
  await db.transaction('rw', db.exercisePrefs, async () => {
    const cur = await db.exercisePrefs.get(exerciseId);
    const next: ExercisePref = { ...(cur ?? { exerciseId }), ...patch, exerciseId, updatedAt: Date.now() };
    for (const k of Object.keys(next) as Array<keyof ExercisePref>) if (next[k] === undefined) delete next[k];
    const err = validatePref(next);
    if (err) throw new RangeError(err);
    await db.exercisePrefs.put(next);
  });
}


// Each machine variant uses its own exercise ID, preserving the existing progression primary key.
export async function createMachineVariant(exerciseId: string, label: string): Promise<string> {
  const get = await loadExerciseLookup();
  const base = get(exerciseId);
  if (!base || !label.trim()) throw new Error('請輸入器械版本名稱');
  const id = newId();
  const { isCustom: _, ...fields } = base;
  const nameZh = (base.nameZh + ' · ' + label.trim()).slice(0, 80);
  const { customExerciseSchema } = await import('../schemas');
  await db.exercisesCustom.put(customExerciseSchema.parse({ ...fields, id, nameZh, updatedAt: Date.now() }));
  return id;
}
