import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { EXERCISES, getBuiltinExercise } from '../../content';
import type { Exercise } from '../../content/types';
import { db } from '../db';
import type { CustomExercise } from '../schemas';

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
