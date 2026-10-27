import { readFileSync } from 'node:fs';
import Dexie from 'dexie';
import { beforeEach, describe, expect, it } from 'vitest';
import { db, FitnessDB, STORES_V3 } from '../../src/db/db';
import { defaultSettings } from '../../src/db/defaults';
import { activateTemplate, getActiveProgram } from '../../src/db/repo/programs';
import { addExerciseToWorkout, startWorkout, logSet, finishWorkout, saveSetDraft, saveMachineContext, updateSet, deleteSet } from '../../src/db/repo/workouts';
import { createMachineVariant } from '../../src/db/repo/exercises';
import { exportBackup, applyBackup } from '../../src/db/backup/backup';
import { exportZip, parseZip } from '../../src/db/backup/zip';
import { parseBackup } from '../../src/db/backup/import';
import { belongsToItem, needsReview, observationText } from '../../src/core/training/logging';
import { computePrs, sessionBestE1rm } from '../../src/core/training/strength';
import { DEFAULT_REPORT_OPTIONS, reportSections, selectedReport, reportText } from '../../src/core/training/report';
import { saveCardio } from '../../src/db/repo/cardio';
import { cardioSchema } from '../../src/db/schemas';

beforeEach(async () => { await Promise.all(db.tables.map((t) => t.clear())); await db.settings.put({ ...defaultSettings(1), onboarded: true }); });
async function session() {
  await activateTemplate('novice-fullbody-barbell');
  const program = (await getActiveProgram())!;
  const id = await startWorkout({ program });
  return (await db.workouts.get(id))!;
}
const input = { exerciseId: 'barbell-back-squat', kind: 'working' as const, weightKg: 60, reps: 6, rir: null };

describe('逐組歸屬、草稿與可靠寫入', () => {
  it('同動作不同項目互不混組；重送同組識別只存一次', async () => {
    const w = await session(); await addExerciseToWorkout(w.id, input.exerciseId, 90);
    const plan = (await db.workouts.get(w.id))!.plan;
    const first = plan[0]!; const second = plan.at(-1)!;
    expect(first.id).not.toBe(second.id);
    const [a, b] = await Promise.all([logSet(w.id, { ...input, setId: 'retry', planItemId: first.id, position: 0 }, 90), logSet(w.id, { ...input, setId: 'retry', planItemId: first.id, position: 0 }, 90)]);
    expect(a.id).toBe(b.id); expect(await db.sets.count()).toBe(1);
    expect(belongsToItem(a, first, 0, plan)).toBe(true); expect(belongsToItem(a, second, plan.length - 1, plan)).toBe(false);
    await logSet(w.id, { ...input, planItemId: second.id }, 90); expect(await db.sets.count()).toBe(2);
  });
  it('草稿不計完成量、成功記組才移除；遲到草稿不覆蓋完成組', async () => {
    const w = await session(); const item = w.plan[0]!;
    const draft = { id: 'draft1', planItemId: item.id!, kind: 'working' as const, position: 0, weightKg: 55, reps: 6, rir: null, flags: ['hard' as const] };
    await saveSetDraft(w.id, draft);
    expect(await db.sets.count()).toBe(0);
    expect((await db.workouts.get(w.id))!.drafts).toHaveLength(1);
    await logSet(w.id, { ...input, ...draft, setId: draft.id }, 90);
    await saveSetDraft(w.id, draft);
    expect((await db.workouts.get(w.id))!.drafts).toHaveLength(0);
  });
  it('非法數值與錯誤項目在寫入前被拒絕', async () => {
    const w = await session();
    await expect(logSet(w.id, { ...input, weightKg: 1001 }, 0)).rejects.toThrow();
    await expect(logSet(w.id, { ...input, planItemId: 'wrong' }, 0)).rejects.toThrow();
    expect(await db.sets.count()).toBe(0);
  });
});

describe('狀態與進步判讀', () => {
  it.each(['form', 'assisted', 'discomfort'] as const)('%s 暫停調整及失敗累計；完成量保留', async (flag) => {
    const w = await session();
    await db.progressionState.put({ exerciseId: input.exerciseId, workingWeightKg: 60, consecutiveFails: 2, deloadCount: 1, updatedAt: 1 });
    for (let i = 0; i < 3; i++) await logSet(w.id, { ...input, flags: i === 2 ? [flag] : [] }, 0);
    const result = await finishWorkout(w.id);
    expect(result.messages[0]!.text).toContain('不累計失敗');
    expect(await db.progressionState.get(input.exerciseId)).toMatchObject({ workingWeightKg: 60, consecutiveFails: 2, deloadCount: 1 });
    expect(await db.sets.count()).toBe(3);
  });
  it('只有吃力仍依原課表判讀；未註記不推估 RIR', async () => {
    const w = await session();
    for (let i = 0; i < 3; i++) await logSet(w.id, { ...input, flags: ['hard'] }, 0);
    await finishWorkout(w.id);
    expect((await db.progressionState.get(input.exerciseId))?.workingWeightKg).toBe(62.5);
    expect(observationText({})).toBe('未註記'); expect(needsReview({ flags: ['hard'] })).toBe(false);
  });
  it('力量 PR 與曲線排除需注意組，實際訓練量仍包含', () => {
    const rows = [{ ...input, date: '2026-10-26', workoutId: 'w', weightKg: 60 }, { ...input, date: '2026-10-26', workoutId: 'w', weightKg: 120, flags: ['assisted' as const] }];
    const options = { formula: 'epley' as const, useRir: false, loadType: 'external' as const, bodyweightKg: 70 };
    const prs = computePrs(rows, options);
    expect(prs.repMaxes.get(6)?.weightKg).toBe(60);
    expect(prs.bestSessionVolume?.value).toBe(1080);
    expect(sessionBestE1rm(rows, options)).toBe(72);
  });
  it('更正／撤銷已完成紀錄不重跑課表，也不倒推下次重量', async () => {
    const w = await session();
    const set = await logSet(w.id, input, 0); await finishWorkout(w.id);
    const program = await getActiveProgram(); const state = await db.progressionState.get(input.exerciseId);
    await updateSet(set.id, { reps: 4, flags: ['form'] });
    expect((await db.workouts.get(w.id))!.correctedAt).toBeTruthy();
    expect((await db.workouts.get(w.id))!.summary).toBeNull();
    await finishWorkout(w.id);
    expect((await getActiveProgram())!.nextDayIndex).toBe(program!.nextDayIndex);
    expect(await db.progressionState.get(input.exerciseId)).toEqual(state);
    await deleteSet(set.id); expect((await db.workouts.get(w.id))!.correctedAt).toBeTruthy();
  });
});

describe('器械與有氧', () => {
  it('設定保存當次快照，下次偏好變動不污染歷史；機台版本獨立', async () => {
    const w = await session();
    await saveMachineContext(w.id, 0, { machine: 'A', seat: '4', unit: 'lb', step: 5, weightMeaning: 'machine' }, true);
    await saveMachineContext(w.id, 0, { machine: 'B', seat: '5' }, false);
    expect((await db.exercisePrefs.get(input.exerciseId))?.context?.machine).toBe('A');
    expect((await db.workouts.get(w.id))!.plan[0]?.context?.machine).toBe('B');
    const variant = await createMachineVariant(input.exerciseId, '另一台');
    expect(variant).not.toBe(input.exerciseId); expect(await db.progressionState.get(variant)).toBeUndefined();
  });
  it('有氧邊界與更新既有紀錄', async () => {
    const record = await saveCardio({ date: '2026-10-26', type: '跑步機', minutes: 30, distanceKm: 3, kcal: null, note: '', speedKmh: 100, inclinePct: 100, resistance: 1000, feeling: '適中' });
    expect(cardioSchema.safeParse(record).success).toBe(true);
    await saveCardio({ ...record, minutes: 20 }); expect(await db.cardio.count()).toBe(1);
    await expect(saveCardio({ ...record, speedKmh: 101 })).rejects.toThrow();
  });
});

describe('v4 備份與升級', () => {
  it('舊版同動作重複項目不重複分配組數；快照未知保持未知', async () => {
    const name = 'upgrade4-' + Date.now(); const old = new Dexie(name); old.version(3).stores(STORES_V3); await old.open();
    await old.table('workouts').put({ id: 'old', plan: [{ exerciseId: 'x' }, { exerciseId: 'x' }] });
    await old.table('sets').put({ id: 's', workoutId: 'old', exerciseId: 'x' }); old.close();
    const upgraded = new FitnessDB(name); await upgraded.open();
    const w = (await upgraded.workouts.get('old'))!; const set = (await upgraded.sets.get('s'))!;
    expect(w.plan[0]?.id).toBe('old:p:0'); expect(set.planItemId).toBe('old:p:0');
    expect(w.plan[0]?.context).toBeUndefined(); expect(set.flags).toBeUndefined();
    upgraded.close(); await Dexie.delete(name);
  });
  it('舊備份最長主鍵可升級；組別位置連續且不由日期猜狀態', async () => {
    const { MIGRATIONS } = await import('../../src/db/backup/migrate');
    const id = 'a'.repeat(100);
    const migrated = MIGRATIONS[3]!({ workouts: [{ id, plan: [{ exerciseId: 'x' }] }], sets: [
      { id: 's2', workoutId: id, exerciseId: 'x', kind: 'working', order: 2 },
      { id: 's1', workoutId: id, exerciseId: 'x', kind: 'working', order: 0 },
    ] });
    const plan = (migrated.workouts![0] as { plan: Array<{ id: string }> }).plan;
    expect(plan[0]!.id.length).toBeLessThanOrEqual(100);
    expect(migrated.sets!.map((s) => (s as { position: number }).position)).toEqual([0, 1]);
  });
  it('完整新欄位與草稿 JSON／ZIP 往返，v1–v4 fixtures 皆可還原', async () => {
    const w = await session();
    await saveMachineContext(w.id, 0, { machine: '器械 A', seat: '4', grip: '窄握', reminder: '慢慢放', unit: 'lb', step: 5 }, true);
    await logSet(w.id, { ...input, flags: ['discomfort'], discomfortArea: '肩', note: '教練看一下' }, 0);
    await saveSetDraft(w.id, { id: 'd', planItemId: w.plan[0]!.id!, position: 1, kind: 'working', weightKg: 60, reps: 6, rir: null, note: '未做' });
    const json = await exportBackup(db, 'test');
    const parsed = parseBackup(JSON.stringify(json)); expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    await applyBackup(db, parsed.data, 'replace');
    expect((await db.sets.toArray())[0]?.note).toBe('教練看一下');
    expect((await db.workouts.get(w.id))?.drafts).toHaveLength(1);
    const zip = await exportZip(db, 'test'); const result = parseZip(new Uint8Array(await zip.blob.arrayBuffer())); expect(result.ok).toBe(true);
    for (const version of [1, 2, 3, 4]) {
      const fixture = readFileSync(new URL('../fixtures/backup-v' + version + '.json', import.meta.url), 'utf8');
      const check = parseBackup(fixture); expect(check.ok, JSON.stringify(check)).toBe(true);
    }
  });
});

describe('教練摘要', () => {
  it('保留變重順序、暖身遞減、跳過、多場與有氧；取消勾選不洩漏待確認內容', async () => {
    const w = await session();
    for (const [n, kg] of [40, 40, 35].entries()) await logSet(w.id, { ...input, weightKg: kg, position: n, flags: n === 2 ? ['form'] : undefined, note: n === 2 ? '請看姿勢' : undefined }, 0);
    await logSet(w.id, { ...input, kind: 'warmup', weightKg: 20 }, 0);
    await logSet(w.id, { ...input, kind: 'drop', weightKg: 25 }, 0);
    const rows = await db.sets.toArray();
    const sections = reportSections([w, { ...w, id: 'second', dayName: '第二場', plan: [] }], rows, [{ id: 'c', type: '快走', minutes: 20, distanceKm: null, note: '', inclinePct: 5 }], (id) => id, 'kg', DEFAULT_REPORT_OPTIONS);
    const text = reportText(selectedReport(w.date, sections, []));
    expect(text).toContain('40 kg × 6／6；35 kg × 6'); expect(text).toContain('第 3 組：姿勢不穩');
    expect(text).toContain('暖身'); expect(text).toContain('遞減組'); expect(text).toContain('第二場'); expect(text).toContain('坡度 5%'); expect(text).toContain('待教練確認');
    const exerciseSection = sections.find((s) => s.review?.length)!;
    const filtered = reportText(selectedReport(w.date, sections, [exerciseSection.id]));
    expect(filtered).not.toContain('請看姿勢'); expect(filtered).not.toContain('待教練確認');
    const privateText = reportText(reportSections([w], rows, [], () => '', 'kg', { context: false, observations: false, notes: false }));
    expect(privateText).not.toContain('姿勢不穩');
  });
});
