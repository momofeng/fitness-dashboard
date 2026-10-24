// 每肌群每週組數：主肌群 1 組、次肌群 0.5 組，只算正式組。

import { MUSCLES, type Muscle, type ProgramTemplate } from '../../content/types';
import type { SetKind } from './strength';

export interface MuscleMap {
  primary: Muscle[];
  secondary: Muscle[];
}

export type MuscleVolume = Record<Muscle, number>;

export function emptyVolume(): MuscleVolume {
  return Object.fromEntries(MUSCLES.map((m) => [m, 0])) as MuscleVolume;
}

function addSets(out: MuscleVolume, map: MuscleMap, sets: number) {
  for (const m of map.primary) out[m] += sets;
  for (const m of map.secondary) if (!map.primary.includes(m)) out[m] += sets * 0.5;
}

export function setsByMuscle(
  sets: Array<{ exerciseId: string; kind: SetKind }>,
  lookup: (id: string) => MuscleMap | undefined,
): MuscleVolume {
  const out = emptyVolume();
  for (const s of sets) {
    if (s.kind !== 'working') continue;
    const map = lookup(s.exerciseId);
    if (map) addSets(out, map, 1);
  }
  return out;
}

/** 課表範本每週各肌群組數：每個訓練日一週出現 daysPerWeek / days.length 次 */
export function programWeeklyVolume(
  program: Pick<ProgramTemplate, 'days' | 'daysPerWeek'>,
  lookup: (id: string) => MuscleMap | undefined,
): MuscleVolume {
  const out = emptyVolume();
  const freq = program.daysPerWeek / Math.max(1, program.days.length);
  for (const day of program.days) {
    for (const slot of day.slots) {
      const map = lookup(slot.exerciseId);
      if (map) addSets(out, map, slot.sets * freq);
    }
  }
  return out;
}

/** 訓練量 = Σ 重量 × 次數（只算正式組） */
export function tonnage(sets: Array<{ weightKg: number; reps: number; kind: SetKind }>): number {
  let t = 0;
  for (const s of sets) if (s.kind === 'working') t += s.weightKg * s.reps;
  return t;
}
