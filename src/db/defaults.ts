import type { Settings } from './schemas';

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
    },
    dayCutoffHour: 4,
    weekStart: 1,
    backup: { lastExportAt: null, remindDays: 7 },
    ai: { enabled: false, provider: null, model: null },
    updatedAt: now,
  };
}

export function smallestPlateKg(s: Settings): number {
  const avail = s.equipment.plates.filter((p) => p.pairs > 0).map((p) => p.kg);
  return avail.length ? Math.min(...avail) : 1.25;
}
