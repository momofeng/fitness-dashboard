// 目標與習慣。習慣打卡一天一筆（id = habitId:date），有這筆就是完成。

import { useLiveQuery } from 'dexie-react-hooks';
import { db, newId } from '../db';
import { goalValueRange, inRange, LIMITS } from '../limits';
import type { Goal, Habit, HabitLog } from '../schemas';

export type GoalInput = Omit<Goal, 'id' | 'createdAt' | 'updatedAt' | 'doneAt' | 'status'> & { id?: string; status?: Goal['status'] };

export function validateGoal(g: GoalInput): string | null {
  if (!g.title.trim()) return '請輸入目標名稱';
  if (g.title.length > 60) return '名稱最多 60 字';
  const [lo, hi] = goalValueRange(g.type);
  for (const [v, label] of [
    [g.targetValue, '目標值'],
    [g.startValue, '起始值'],
    [g.current, '目前值'],
  ] as const) {
    if (v != null && !(Number.isFinite(v) && v >= lo && v <= hi)) return `${label}請輸入 ${lo}–${hi}`;
  }
  if (g.type === 'lift') {
    if (!g.exerciseId) return '請選擇動作';
    if (g.targetReps == null || !Number.isInteger(g.targetReps) || !inRange('targetReps', g.targetReps)) return `次數請輸入 ${LIMITS.targetReps[0]}–${LIMITS.targetReps[1]}`;
  }
  if (g.type === 'circ' && !g.circ) return '請選擇圍度部位';
  return null;
}

export async function saveGoal(input: GoalInput): Promise<Goal> {
  const err = validateGoal(input);
  if (err) throw new RangeError(err);
  const now = Date.now();
  const cur = input.id ? await db.goals.get(input.id) : undefined;
  const row: Goal = {
    ...input,
    title: input.title.trim(),
    id: input.id ?? newId(),
    status: input.status ?? cur?.status ?? 'active',
    doneAt: cur?.doneAt ?? null,
    createdAt: cur?.createdAt ?? now,
    updatedAt: now,
  };
  await db.goals.put(row);
  return row;
}

export async function setGoalStatus(id: string, status: Goal['status']) {
  await db.goals.update(id, { status, doneAt: status === 'done' ? Date.now() : null, updatedAt: Date.now() });
}

export async function updateGoalCurrent(id: string, current: number | null) {
  const g = await db.goals.get(id);
  if (!g) return;
  const err = validateGoal({ ...g, current });
  if (err) throw new RangeError(err);
  await db.goals.update(id, { current, updatedAt: Date.now() });
}

export async function deleteGoal(id: string): Promise<Goal | undefined> {
  const g = await db.goals.get(id);
  if (g) await db.goals.delete(id);
  return g;
}

// ---------- 習慣 ----------

export const habitLogId = (habitId: string, date: string) => `${habitId}:${date}`;

export type HabitInput = Pick<Habit, 'name' | 'rule' | 'perWeek'> & { id?: string };

export function validateHabit(h: HabitInput): string | null {
  if (!h.name.trim()) return '請輸入習慣名稱';
  if (h.name.length > 40) return '名稱最多 40 字';
  if (!Number.isInteger(h.perWeek) || !inRange('habitPerWeek', h.perWeek)) return '每週次數請輸入 1–7';
  return null;
}

export async function saveHabit(input: HabitInput): Promise<Habit> {
  const err = validateHabit(input);
  if (err) throw new RangeError(err);
  const now = Date.now();
  const cur = input.id ? await db.habits.get(input.id) : undefined;
  const order = cur?.order ?? (await db.habits.count());
  const row: Habit = {
    id: input.id ?? newId(),
    name: input.name.trim(),
    rule: input.rule,
    perWeek: input.perWeek,
    archived: cur?.archived ?? false,
    order,
    createdAt: cur?.createdAt ?? now,
    updatedAt: now,
  };
  await db.habits.put(row);
  return row;
}

export async function setHabitArchived(id: string, archived: boolean) {
  await db.habits.update(id, { archived, updatedAt: Date.now() });
}

export async function deleteHabit(id: string): Promise<{ habit: Habit; logs: HabitLog[] } | null> {
  return db.transaction('rw', db.habits, db.habitLogs, async () => {
    const habit = await db.habits.get(id);
    if (!habit) return null;
    const logs = await db.habitLogs.filter((l) => l.habitId === id).toArray();
    await db.habitLogs.bulkDelete(logs.map((l) => l.id));
    await db.habits.delete(id);
    return { habit, logs };
  });
}

export async function restoreHabit(data: { habit: Habit; logs: HabitLog[] }) {
  await db.transaction('rw', db.habits, db.habitLogs, async () => {
    await db.habits.put(data.habit);
    if (data.logs.length) await db.habitLogs.bulkPut(data.logs);
  });
}

/** 手動打卡切換；回傳切換後是否完成 */
export async function toggleHabit(habitId: string, date: string): Promise<boolean> {
  const id = habitLogId(habitId, date);
  return db.transaction('rw', db.habitLogs, async () => {
    if (await db.habitLogs.get(id)) {
      await db.habitLogs.delete(id);
      return false;
    }
    await db.habitLogs.put({ id, habitId, date, updatedAt: Date.now() });
    return true;
  });
}

// ---------- hooks ----------

export function useGoals(): Goal[] | undefined {
  return useLiveQuery(async () => (await db.goals.toArray()).sort((a, b) => a.createdAt - b.createdAt), []);
}

export function useHabits(): Habit[] | undefined {
  return useLiveQuery(async () => (await db.habits.toArray()).sort((a, b) => a.order - b.order), []);
}

export function useHabitLogsRange(from: string, to: string): HabitLog[] | undefined {
  return useLiveQuery(() => db.habitLogs.where('date').between(from, to, true, true).toArray(), [from, to]);
}
