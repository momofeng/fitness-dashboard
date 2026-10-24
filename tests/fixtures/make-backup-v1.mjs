// 產生 v1 合成備份 fixture（固定數值，可重現）。這份 fixture 要永久保留，測試「舊版備份可匯入最新版」。
// 用法：node tests/fixtures/make-backup-v1.mjs
import { writeFileSync } from 'node:fs';

const out = new URL('./backup-v1.json', import.meta.url);
const t0 = Date.UTC(2026, 9, 1, 0, 0, 0);
const pad = (n) => String(n).padStart(2, '0');
const day = (i) => {
  const d = new Date(Date.UTC(2026, 9, 1 + i));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
};

const settings = {
  id: 'app',
  onboarded: true,
  disclaimerAcceptedAt: t0,
  profile: { name: '測試', sex: 'male', birthYear: 1996, heightCm: 175, activity: 1.55, experience: 'novice' },
  units: { weight: 'kg' },
  theme: 'dark',
  nutrition: { mode: 'rate', weeklyGainPct: 0.3, surplusKcal: 300, proteinPerKg: 1.8, fatPct: 25, fatMinPerKg: 0.6, waterTargetMl: 3000 },
  training: {
    e1rmFormula: 'epley', useRir: false, failsBeforeDeload: 3, doubleFailsBeforeDeload: 2, deloadFactor: 0.9,
    stallSessions: 3, stallMinDays: 14, volumeMin: 10, volumeMax: 20, defaultRestSec: 120,
    keepAwake: true, sound: true, vibrate: true,
  },
  equipment: {
    barKg: 20,
    plates: [{ kg: 20, pairs: 4 }, { kg: 10, pairs: 2 }, { kg: 5, pairs: 2 }, { kg: 2.5, pairs: 2 }, { kg: 1.25, pairs: 2 }],
    dumbbellStepKg: 2,
    machineStepKg: 2.5,
  },
  dayCutoffHour: 4,
  weekStart: 1,
  backup: { lastExportAt: null, remindDays: 7 },
  ai: { enabled: false, provider: null, model: null },
  updatedAt: t0,
};

// 15 天體重：70.00 起每天 +0.05，第 6 天缺漏（共 14 筆）
const bodyMetrics = [];
for (let i = 0; i < 15; i++) {
  if (i === 5) continue;
  bodyMetrics.push({
    id: `fx-b${i}`, date: day(i), weightKg: Number((70 + i * 0.05).toFixed(2)),
    bodyFatPct: null, circ: {}, note: '', updatedAt: t0 + i,
  });
}

const workouts = [{
  id: 'fx-w1', date: day(2), status: 'done', programId: null, dayId: null, dayName: '全身 A', plan: [],
  startedAt: t0, endedAt: t0 + 3600000, restEndsAt: null, notes: '', summary: null, updatedAt: t0,
}];
const sets = [0, 1, 2].map((i) => ({
  id: `fx-s${i}`, workoutId: 'fx-w1', date: day(2), exerciseId: 'barbell-back-squat', order: i, kind: 'working',
  weightKg: 60, reps: 5, rir: null, completedAt: t0 + i * 180000, updatedAt: t0,
}));

const tables = { settings: [settings], bodyMetrics, workouts, sets, dailyLogs: [{ date: day(2), waterMl: 2000, updatedAt: t0 }] };
writeFileSync(
  out,
  JSON.stringify({ app: 'fitness-dashboard', schemaVersion: 1, appVersion: '0.1.0', exportedAt: t0, includesPhotos: false, tables }, null, 2) + '\n',
);
console.log('wrote', bodyMetrics.length, 'body metrics');
