// 產生 v2 合成備份 fixture（固定數值，可重現）：backup-v2.json（不含照片）與 backup-v2.zip（含 1 張照片）。
// 這兩份 fixture 要永久保留，測試「舊版備份可匯入最新版」。
// 用法：node tests/fixtures/make-backup-v2.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { zipSync } from 'fflate';

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
  nutrition: {
    mode: 'rate', weeklyGainPct: 0.3, surplusKcal: 300, proteinPerKg: 1.8, fatPct: 25, fatMinPerKg: 0.6, waterTargetMl: 3000,
    tdeeOverride: 2550, tdeeAppliedAt: t0 + 86400000 * 20,
  },
  training: {
    e1rmFormula: 'epley', useRir: false, failsBeforeDeload: 3, doubleFailsBeforeDeload: 2, deloadFactor: 0.9,
    stallSessions: 3, stallMinDays: 14, volumeMin: 10, volumeMax: 20, defaultRestSec: 120,
    keepAwake: true, sound: true, vibrate: true,
    stallThresholdPct: 1.5,
    warmup: { barReps: 8, steps: [{ pct: 50, reps: 5 }, { pct: 75, reps: 3 }] },
  },
  equipment: {
    barKg: 20,
    plates: [{ kg: 20, pairs: 4 }, { kg: 10, pairs: 2 }, { kg: 5, pairs: 2 }, { kg: 2.5, pairs: 2 }, { kg: 1.25, pairs: 2 }],
    dumbbellStepKg: 2,
    machineStepKg: 2.5,
    ezBarKg: 8,
    barLb: 45,
    platesLb: [{ lb: 45, pairs: 4 }, { lb: 25, pairs: 2 }, { lb: 10, pairs: 2 }, { lb: 5, pairs: 2 }, { lb: 2.5, pairs: 2 }],
  },
  recovery: { lowSleepH: 6, lowEnergy: 2, deloadUntil: null, deloadSetsPct: 60, deloadWeightPct: 90 },
  dayCutoffHour: 4,
  weekStart: 1,
  backup: { lastExportAt: null, remindDays: 7, lastFullExportAt: null },
  ai: { enabled: false, provider: null, model: null },
  updatedAt: t0,
};

const bodyMetrics = [];
for (let i = 0; i < 21; i++) {
  bodyMetrics.push({ id: `body:${day(i)}`, date: day(i), weightKg: Number((70 + i * 0.03).toFixed(2)), bodyFatPct: null, circ: {}, note: '', updatedAt: t0 + i });
}
const dailyLogs = [];
for (let i = 0; i < 21; i++) {
  dailyLogs.push({
    date: day(i), waterMl: 2500, sleepHours: 7 - (i % 3) * 0.5, energy: 3 + (i % 2),
    ...(i % 5 === 0 ? { soreness: ['quads', 'glutes'] } : {}),
    ...(i === 3 ? { intakeComplete: false } : {}),
    updatedAt: t0 + i,
  });
}

const workouts = [{
  id: 'fx-w1', date: day(2), status: 'done', programId: null, dayId: null, dayName: '全身 A', plan: [],
  startedAt: t0, endedAt: t0 + 3600000, restEndsAt: null, notes: '', summary: null, deload: false, updatedAt: t0,
}];
const sets = [0, 1, 2].map((i) => ({
  id: `fx-s${i}`, workoutId: 'fx-w1', date: day(2), exerciseId: 'barbell-back-squat', order: i, kind: 'working',
  weightKg: 60, reps: 5, rir: null, completedAt: t0 + i * 180000, updatedAt: t0,
})).concat([{
  id: 'fx-s3', workoutId: 'fx-w1', date: day(2), exerciseId: 'barbell-back-squat', order: 3, kind: 'drop',
  weightKg: 47.5, reps: 8, rir: null, completedAt: t0 + 3 * 180000, updatedAt: t0,
}]);

const exercisePrefs = [{ exerciseId: 'dumbbell-curl', note: '', repMin: 10, repMax: 15, updatedAt: t0 }];
const exercisesCustom = [{
  id: 'fx-ex1', nameZh: '測試划船', aliases: [], nameEn: 'Test Row', primary: ['upperBack', 'lats'], secondary: ['biceps'],
  equipment: 'machine', category: 'compound', loadType: 'external', defaultIncrementKg: 2.5, defaultRepRange: [8, 12], cues: '', updatedAt: t0,
}];
const foodUsage = [{ foodKey: 'custom:fx-f1', name: '測試優格', count: 5, lastUsedAt: t0, lastQty: 1, lastUnit: 'serving' }];

const products = [
  {
    id: 'fx-p1', kind: 'supplement', name: '乳清蛋白 2 磅', brand: '', category: 'protein', status: 'using',
    price: 1200, servingsPerContainer: 30, servingLabel: '1 匙 30 g', proteinPerServingG: 24, dailyServings: 1,
    containersBought: 1, adjustServings: -2, remindDays: 7, purchasedAt: day(0), note: '', createdAt: t0, updatedAt: t0,
  },
  {
    id: 'fx-p2', kind: 'gear', name: '舉重腰帶', brand: '', category: 'belt', status: 'using',
    price: 1500, servingsPerContainer: null, servingLabel: '', proteinPerServingG: null, dailyServings: null,
    containersBought: 1, adjustServings: 0, remindDays: 0, purchasedAt: day(0), note: '10 mm', createdAt: t0, updatedAt: t0,
  },
];
const supplementLogs = [0, 1, 2].map((i) => ({ id: `fx-p1:${day(i)}`, productId: 'fx-p1', date: day(i), servings: 1, updatedAt: t0 + i }));
const goals = [
  {
    id: 'fx-g1', type: 'lift', title: '深蹲 100 kg × 5', exerciseId: 'barbell-back-squat', targetReps: 5, circ: null, unit: '',
    startValue: 60, targetValue: 100, current: null, dueDate: day(90), status: 'active', doneAt: null, createdAt: t0, updatedAt: t0,
  },
  {
    id: 'fx-g2', type: 'bodyweight', title: '體重 75 kg', exerciseId: null, targetReps: null, circ: null, unit: '',
    startValue: 70, targetValue: 75, current: null, dueDate: null, status: 'active', doneAt: null, createdAt: t0, updatedAt: t0,
  },
];
const habits = [
  { id: 'fx-h1', name: '睡前伸展', rule: 'manual', perWeek: 5, archived: false, order: 0, createdAt: t0, updatedAt: t0 },
  { id: 'fx-h2', name: '每天量體重', rule: 'weighIn', perWeek: 7, archived: false, order: 1, createdAt: t0, updatedAt: t0 },
];
const habitLogs = [0, 1].map((i) => ({ id: `fx-h1:${day(i)}`, habitId: 'fx-h1', date: day(i), updatedAt: t0 + i }));

const tables = {
  settings: [settings], bodyMetrics, workouts, sets, dailyLogs, exercisePrefs, exercisesCustom, foodUsage,
  products, supplementLogs, goals, habits, habitLogs, photos: [],
};
const envelope = (includesPhotos, t) => ({ app: 'fitness-dashboard', schemaVersion: 2, appVersion: '0.2.0', exportedAt: t0, includesPhotos, tables: t });

writeFileSync(new URL('./backup-v2.json', import.meta.url), JSON.stringify(envelope(false, tables), null, 2) + '\n');

// ZIP：同一份資料加 1 張照片
const jpg = readFileSync(new URL('./photo-16x12.jpg', import.meta.url));
const photo = {
  id: 'fx-photo-1', date: day(20), pose: 'front', note: '第 3 週', width: 16, height: 12, bytes: jpg.length,
  thumb: `data:image/jpeg;base64,${jpg.toString('base64')}`, createdAt: t0, updatedAt: t0,
};
const zipTables = { ...tables, photos: [photo] };
const zipped = zipSync(
  {
    'backup.json': [new TextEncoder().encode(JSON.stringify(envelope(true, zipTables))), { level: 6 }],
    [`photos/${photo.id}.jpg`]: [new Uint8Array(jpg), { level: 0 }],
  },
  { mtime: new Date(t0) },
);
writeFileSync(new URL('./backup-v2.zip', import.meta.url), zipped);
console.log('wrote backup-v2.json and backup-v2.zip');
