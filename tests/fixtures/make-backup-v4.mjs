// Permanent synthetic v4 backup, derived without changing older fixtures.
import { readFileSync, writeFileSync } from 'node:fs';
import { unzipSync, zipSync } from 'fflate';
function derive(env) {
  const tables = structuredClone(env.tables);
  for (const w of tables.workouts ?? []) w.plan = w.plan.map((p, i) => ({ ...p, id: w.id + ':p:' + i }));
  for (const s of tables.sets ?? []) {
    const w = tables.workouts.find((w) => w.id === s.workoutId);
    const p = w?.plan.find((p) => p.exerciseId === s.exerciseId);
    if (p) s.planItemId = p.id;
    s.flags = ['hard']; s.note = '合成測試資料';
  }
  const w = tables.workouts?.[0];
  if (w?.plan[0]) w.plan[0].context = { machine: '測試機 A', seat: '4', unit: 'kg', weightMeaning: 'machine', step: 5 };
  return { ...env, schemaVersion: 4, appVersion: '0.4.0', tables };
}
const source = JSON.parse(readFileSync(new URL('./backup-v3.json', import.meta.url), 'utf8'));
writeFileSync(new URL('./backup-v4.json', import.meta.url), JSON.stringify(derive(source), null, 2) + '\n');
const files = unzipSync(new Uint8Array(readFileSync(new URL('./backup-v3.zip', import.meta.url))));
const env = derive(JSON.parse(new TextDecoder().decode(files['backup.json'])));
files['backup.json'] = new TextEncoder().encode(JSON.stringify(env));
writeFileSync(new URL('./backup-v4.zip', import.meta.url), zipSync(files, { mtime: new Date(Date.UTC(2026, 9, 26)) }));
console.log('wrote backup-v4.json and backup-v4.zip');
