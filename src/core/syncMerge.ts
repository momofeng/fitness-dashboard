export type SyncRow = Record<string, unknown>;
export type SyncTables = Record<string, SyncRow[]>;
export interface SyncConflict { id: string; table: string; key: string; local?: SyncRow; remote?: SyncRow }
export function canonical(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  return '{' + Object.entries(value).filter(([, v]) => v !== undefined).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([k, v]) => JSON.stringify(k) + ':' + canonical(v)).join(',') + '}';
}
function equal(a: SyncRow | undefined, b: SyncRow | undefined, stamp: string) {
  const trim = (r?: SyncRow) => r && Object.fromEntries(Object.entries(r).filter(([k]) => k !== stamp));
  return canonical(trim(a)) === canonical(trim(b));
}
export function mergeSyncTables(base: SyncTables, local: SyncTables, remote: SyncTables, specs: Record<string, { key: string; stamp: string }>, choices: Record<string, 'local' | 'remote'> = {}) {
  const tables: SyncTables = {}; const conflicts: SyncConflict[] = [];
  for (const [table, spec] of Object.entries(specs)) {
    const index = (rows: SyncRow[] = []) => new Map(rows.map((r) => [String(r[spec.key]), r]));
    const b = index(base[table]), l = index(local[table]), r = index(remote[table]);
    const merged: SyncRow[] = [];
    for (const key of new Set([...b.keys(), ...l.keys(), ...r.keys()])) {
      const before = b.get(key), left = l.get(key), right = r.get(key);
      let pick: SyncRow | undefined;
      if (equal(left, right, spec.stamp)) pick = right ?? left;
      else if (equal(left, before, spec.stamp)) pick = right;
      else if (equal(right, before, spec.stamp)) pick = left;
      else {
        const id = table + ':' + key; const choice = choices[id];
        if (!choice) { conflicts.push({ id, table, key, local: left, remote: right }); continue; }
        pick = choice === 'local' ? left : right;
      }
      if (pick) merged.push(pick);
    }
    tables[table] = merged.sort((a, b) => String(a[spec.key]) < String(b[spec.key]) ? -1 : String(a[spec.key]) > String(b[spec.key]) ? 1 : 0);
  }
  for (const [parents, children, foreignKey, label] of [
    ['workouts', 'sets', 'workoutId', '組數與場次刪除衝突'],
    ['products', 'supplementLogs', 'productId', '補給品與打卡刪除衝突'],
    ['habits', 'habitLogs', 'habitId', '習慣與打卡刪除衝突'],
  ] as const) {
    const parentIds = new Set((tables[parents] ?? []).map((r) => r.id));
    for (const parentId of new Set((tables[children] ?? []).filter((r) => !parentIds.has(r[foreignKey])).map((r) => String(r[foreignKey])))) {
      const rowConflict = parents + ':' + parentId;
      if (conflicts.some((c) => c.id === rowConflict)) continue;
      if (choices[rowConflict]) { tables[children] = tables[children]!.filter((r) => String(r[foreignKey]) !== parentId); continue; }
      const id = parents + ':reference:' + parentId;
      const left = local[parents]?.find((r) => r.id === parentId), right = remote[parents]?.find((r) => r.id === parentId);
      const choice = choices[id];
      if (!choice) conflicts.push({ id, table: parents, key: label, local: left, remote: right });
      else {
        const parent = choice === 'local' ? left : right;
        if (parent) { tables[parents] ??= []; tables[parents].push(parent); }
        else tables[children] = tables[children]!.filter((r) => String(r[foreignKey]) !== parentId);
      }
    }
  }
  const active = (tables.programs ?? []).filter((r) => r.isActive === 1);
  if (active.length > 1) {
    const id = 'programs:active-choice'; const choice = choices[id];
    const source = choice === 'local' ? local : remote;
    const selectedId = source.programs?.find((r) => r.isActive === 1)?.id;
    if (!choice || !selectedId) conflicts.push({ id, table: 'programs', key: '啟用課表', local: local.programs?.find((r) => r.isActive === 1), remote: remote.programs?.find((r) => r.isActive === 1) });
    else tables.programs = tables.programs!.map((r) => ({ ...r, isActive: r.id === selectedId ? 1 : 0 }));
  }
  return { tables, conflicts };
}
