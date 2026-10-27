import { belongsToItem, observationText, needsReview, WEIGHT_LABEL, type SetFlag } from './logging';
import { fmt, toDisplayWeight } from '../units';
type Context = { machine?: string; seat?: string; grip?: string; reminder?: string; unit?: 'kg' | 'lb'; weightMeaning?: keyof typeof WEIGHT_LABEL };
export interface ReportWorkout {
  id: string; date: string; dayName: string; startedAt: number; endedAt: number | null; notes: string; feeling?: string;
  plan: Array<{ id?: string; exerciseId: string; nameSnapshot?: string; sets: number; skipReason?: string; replacedBy?: string; context?: Context }>;
}
export interface ReportSet {
  workoutId: string; exerciseId: string; planItemId?: string; order: number; kind: 'working' | 'warmup' | 'drop';
  weightKg: number; reps: number; rir: number | null; flags?: SetFlag[]; note?: string; discomfortArea?: string;
}
export interface ReportCardio { id: string; type: string; minutes: number; distanceKm: number | null; note: string; speedKmh?: number | null; inclinePct?: number | null; resistance?: number | null; feeling?: string }
export interface ReportSection { id: string; title: string; lines: string[]; review?: string[] }
export interface ReportOptions { context: boolean; observations: boolean; notes: boolean }
export const DEFAULT_REPORT_OPTIONS: ReportOptions = { context: true, observations: true, notes: true };

function groupedSets(sets: ReportSet[], unit: 'kg' | 'lb') {
  const groups: Array<{ weight: number; reps: number[] }> = [];
  for (const s of sets) {
    const last = groups.at(-1);
    if (last?.weight === s.weightKg) last.reps.push(s.reps);
    else groups.push({ weight: s.weightKg, reps: [s.reps] });
  }
  return groups.map((g) => fmt(toDisplayWeight(g.weight, unit), 2) + ' ' + unit + ' × ' + g.reps.join('／')).join('；');
}

export function reportSections(workouts: ReportWorkout[], sets: ReportSet[], cardio: ReportCardio[], getName: (id: string) => string, unit: 'kg' | 'lb', options: ReportOptions): ReportSection[] {
  const out: ReportSection[] = [];
  for (const w of [...workouts].sort((a, b) => a.startedAt - b.startedAt)) {
    const list = sets.filter((s) => s.workoutId === w.id).sort((a, b) => a.order - b.order);
    out.push({ id: w.id + ':overview', title: w.dayName, lines: [
      '時間 ' + (w.endedAt == null ? '未結束' : Math.max(0, Math.round((w.endedAt - w.startedAt) / 60000)) + ' 分鐘') + ' · 全場正式組 ' + list.filter((s) => s.kind === 'working').length + ' 組',
      ...(w.feeling ? ['整體感受：' + w.feeling] : []), ...(options.notes && w.notes ? ['給教練：' + w.notes] : []),
    ] });
    const planned = w.plan.map((p, i) => ({ p, i }));
    const orphanIds = [...new Set(list.filter((s) => !planned.some(({ p, i }) => belongsToItem(s, p, i, w.plan))).map((s) => s.exerciseId))];
    for (const { p, i } of [...planned, ...orphanIds.map((id, i) => ({ p: { exerciseId: id, sets: 0 } as ReportWorkout['plan'][number], i: w.plan.length + i }))]) {
      const rows = i < w.plan.length ? list.filter((s) => belongsToItem(s, p, i, w.plan)) : list.filter((s) => s.exerciseId === p.exerciseId && !planned.some(({ p: q, i: j }) => belongsToItem(s, q, j, w.plan)));
      const working = rows.filter((s) => s.kind === 'working');
      const u = p.context?.unit ?? unit;
      const name = p.nameSnapshot ?? getName(p.exerciseId);
      const lines = ['正式組 ' + working.length + '／計畫 ' + p.sets + ' 組', groupedSets(working, u) || '未記錄正式組'];
      if (options.context) {
        lines.push(WEIGHT_LABEL[p.context?.weightMeaning ?? 'unknown']);
        const c = p.context;
        const context = [c?.machine, c?.seat ? '座椅／靠墊 ' + c.seat : '', c?.grip ? '握把 ' + c.grip : '', c?.reminder ? '提醒：' + c.reminder : ''].filter(Boolean).join(' · ');
        if (context) lines.push(context);
      }
      if (p.skipReason) lines.push('跳過剩餘組：' + p.skipReason);
      if (p.replacedBy) {
        const next = w.plan.find((v) => v.id === p.replacedBy);
        lines.push('剩餘組替代為：' + (next?.nameSnapshot ?? (next ? getName(next.exerciseId) : '其他動作')));
      }
      const warm = rows.filter((s) => s.kind === 'warmup');
      const drop = rows.filter((s) => s.kind === 'drop');
      if (warm.length) lines.push('暖身 ' + warm.length + ' 組：' + groupedSets(warm, u));
      if (drop.length) lines.push('遞減組：' + groupedSets(drop, u));
      const review: string[] = [];
      if (options.observations) {
        for (const kind of ['working', 'warmup', 'drop'] as const) {
          rows.filter((s) => s.kind === kind).forEach((s, n) => {
            const prefix = (kind === 'working' ? '第 ' : kind === 'warmup' ? '暖身第 ' : '遞減第 ') + (n + 1) + ' 組';
            if (observationText(s) !== '未註記' || s.rir != null) lines.push(prefix + '：' + observationText(s) + (s.rir != null ? ' · RIR ' + s.rir : ''));
            if (needsReview(s) || s.note) review.push(w.dayName + '／' + name + '／' + prefix + '：' + observationText(s));
          });
        }
      }
      out.push({ id: w.id + ':' + (p.id ?? 'legacy-' + i), title: name, lines, review });
    }
  }
  for (const c of cardio) out.push({ id: 'cardio:' + c.id, title: '有氧 · ' + c.type, lines: [
    fmt(c.minutes, 0) + ' 分鐘' + (c.distanceKm != null ? ' · ' + fmt(c.distanceKm, 2) + ' km' : ''),
    ...[c.speedKmh != null ? '速度 ' + c.speedKmh + ' km/h' : '', c.inclinePct != null ? '坡度 ' + c.inclinePct + '%' : '', c.resistance != null ? '阻力 ' + c.resistance : '', c.feeling ? '感受：' + c.feeling : '', options.notes ? c.note : ''].filter(Boolean),
  ] });
  return out;
}
export function selectedReport(date: string, sections: ReportSection[], excluded: string[]): ReportSection[] {
  const selected = sections.filter((s) => !excluded.includes(s.id));
  const review = selected.flatMap((s) => s.review ?? []);
  return [{ id: 'heading', title: date + ' 訓練紀錄', lines: [] }, ...selected,
    ...(review.length ? [{ id: 'review', title: '待教練確認', lines: review }] : []),
    { id: 'footnote', title: '', lines: ['狀態僅列已註記項目；未註記不代表姿勢良好。'] }];
}
export function reportText(sections: ReportSection[]): string {
  return sections.map((s) => [s.title, ...s.lines].filter(Boolean).join('\n')).join('\n\n');
}
