import { useLiveQuery } from 'dexie-react-hooks';
import { getTemplate } from '../../content/programTemplates';
import type { ProgramTemplate } from '../../content/types';
import { db, newId } from '../db';
import type { Program } from '../schemas';

export function programFromTemplate(t: ProgramTemplate, now = Date.now()): Program {
  return {
    id: newId(),
    name: t.name,
    templateId: t.id,
    isActive: 1,
    daysPerWeek: t.daysPerWeek,
    days: t.days.map((d) => ({ ...d, slots: d.slots.map((s) => ({ ...s })) })),
    nextDayIndex: 0,
    createdAt: now,
    updatedAt: now,
  };
}

/** 套用範本：建立一份可編輯的課表並設為目前課表 */
export async function activateTemplate(templateId: string): Promise<Program> {
  const t = getTemplate(templateId);
  if (!t) throw new Error(`找不到課表範本 ${templateId}`);
  const program = programFromTemplate(t);
  await db.transaction('rw', db.programs, async () => {
    await deactivateAll();
    await db.programs.put(program);
  });
  return program;
}

async function deactivateAll() {
  const active = await db.programs.where('isActive').equals(1).toArray();
  const now = Date.now();
  for (const p of active) await db.programs.update(p.id, { isActive: 0, updatedAt: now });
}

export async function setActiveProgram(id: string) {
  await db.transaction('rw', db.programs, async () => {
    await deactivateAll();
    await db.programs.update(id, { isActive: 1, updatedAt: Date.now() });
  });
}

export async function saveProgram(p: Program) {
  await db.programs.put({ ...p, updatedAt: Date.now() });
}

export async function deleteProgram(id: string) {
  await db.programs.delete(id);
}

export async function getActiveProgram(): Promise<Program | undefined> {
  return db.programs.where('isActive').equals(1).first();
}

export function useActiveProgram(): Program | null | undefined {
  return useLiveQuery(async () => (await getActiveProgram()) ?? null, []);
}

export function usePrograms(): Program[] | undefined {
  return useLiveQuery(() => db.programs.orderBy('id').toArray().then((ps) => ps.sort((a, b) => b.updatedAt - a.updatedAt)), []);
}
