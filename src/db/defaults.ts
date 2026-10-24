import type { Settings } from './schemas';

// v2 新增的設定欄位預設值：defaultSettings 與 v1→v2 遷移共用
export const DEFAULT_WARMUP: Settings['training']['warmup'] = {
  barReps: 10,
  steps: [
    { pct: 40, reps: 5 },
    { pct: 60, reps: 3 },
    { pct: 80, reps: 2 },
  ],
};
export const DEFAULT_PLATES_LB: Settings['equipment']['platesLb'] = [
  { lb: 45, pairs: 4 },
  { lb: 35, pairs: 0 },
  { lb: 25, pairs: 2 },
  { lb: 10, pairs: 2 },
  { lb: 5, pairs: 2 },
  { lb: 2.5, pairs: 2 },
];
export const DEFAULT_RECOVERY: Settings['recovery'] = {
  lowSleepH: 6,
  lowEnergy: 2,
  deloadUntil: null,
  deloadSetsPct: 60,
  deloadWeightPct: 90,
};
export const V2_DEFAULTS = {
  stallThresholdPct: 1,
  ezBarKg: 10,
  barLb: 45,
} as const;

/** 首次使用前的預設設定；onboarding 會覆寫個人資料 */
export function defaultSettings(now: number): Settings {
  return {
    id: 'app',
    onboarded: false,
    disclaimerAcceptedAt: null,
    profile: {
      name: '',
      sex: 'male',
      birthYear: 1995,
      heightCm: 172,
      activity: 1.55,
      experience: 'novice',
    },
    units: { weight: 'kg' },
    theme: 'dark',
    nutrition: {
      mode: 'rate',
      weeklyGainPct: 0.3,
      surplusKcal: 300,
      proteinPerKg: 1.8,
      fatPct: 25,
      fatMinPerKg: 0.6,
      waterTargetMl: 3000,
      tdeeOverride: null,
      tdeeAppliedAt: null,
    },
    training: {
      e1rmFormula: 'epley',
      useRir: false,
      failsBeforeDeload: 3,
      doubleFailsBeforeDeload: 2,
      deloadFactor: 0.9,
      stallSessions: 3,
      stallMinDays: 14,
      volumeMin: 10,
      volumeMax: 20,
      defaultRestSec: 120,
      keepAwake: true,
      sound: true,
      vibrate: true,
      stallThresholdPct: V2_DEFAULTS.stallThresholdPct,
      warmup: structuredClone(DEFAULT_WARMUP),
    },
    equipment: {
      barKg: 20,
      plates: [
        { kg: 25, pairs: 0 },
        { kg: 20, pairs: 4 },
        { kg: 15, pairs: 2 },
        { kg: 10, pairs: 2 },
        { kg: 5, pairs: 2 },
        { kg: 2.5, pairs: 2 },
        { kg: 1.25, pairs: 2 },
      ],
      dumbbellStepKg: 2,
      machineStepKg: 2.5,
      ezBarKg: V2_DEFAULTS.ezBarKg,
      barLb: V2_DEFAULTS.barLb,
      platesLb: structuredClone(DEFAULT_PLATES_LB),
    },
    recovery: { ...DEFAULT_RECOVERY },
    dayCutoffHour: 4,
    weekStart: 1,
    backup: { lastExportAt: null, remindDays: 7, lastFullExportAt: null },
    ai: { enabled: false, provider: null, model: null },
    updatedAt: now,
  };
}

export function smallestPlateKg(s: Settings): number {
  const avail = s.equipment.plates.filter((p) => p.pairs > 0).map((p) => p.kg);
  return avail.length ? Math.min(...avail) : 1.25;
}

export function smallestPlateLb(s: Settings): number {
  const avail = s.equipment.platesLb.filter((p) => p.pairs > 0).map((p) => p.lb);
  return avail.length ? Math.min(...avail) : 2.5;
}

/** 這個器材的槓重（kg）：EZ 槓另外設定 */
export function barKgFor(s: Settings, equipment: string): number {
  return equipment === 'ezbar' ? s.equipment.ezBarKg : s.equipment.barKg;
}
