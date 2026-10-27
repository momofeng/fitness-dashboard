export const SET_FLAGS = ['hard', 'form', 'assisted', 'discomfort'] as const;
export type SetFlag = (typeof SET_FLAGS)[number];
export const FLAG_LABEL: Record<SetFlag, string> = { hard: '吃力', form: '姿勢不穩', assisted: '有人協助', discomfort: '不適' };
export const WEIGHT_MEANINGS = ['unknown', 'machine', 'perHand', 'total', 'assistance', 'bodyweight'] as const;
export const WEIGHT_LABEL: Record<(typeof WEIGHT_MEANINGS)[number], string> = {
  unknown: '重量定義未註記', machine: '器械標示', perHand: '啞鈴單手', total: '含槓／兩側總重', assistance: '輔助重量', bodyweight: '徒手／自重',
};
export const SKIP_REASONS = ['器械占用', '時間不足', '不適', '其他'] as const;
export function needsReview(set: { flags?: readonly SetFlag[] }): boolean {
  return !!set.flags?.some((f) => f !== 'hard');
}
export function observationText(set: { flags?: readonly SetFlag[]; discomfortArea?: string; note?: string }): string {
  return [...(set.flags ?? []).map((f) => FLAG_LABEL[f]), set.discomfortArea ? '部位：' + set.discomfortArea : '', set.note ?? ''].filter(Boolean).join('、') || '未註記';
}

/** Legacy sets belong only to the first matching item; repeated exercise cards never duplicate them. */
export function belongsToItem(
  set: { exerciseId: string; planItemId?: string },
  item: { exerciseId: string; id?: string },
  index: number,
  plan: Array<{ exerciseId: string; id?: string }>,
): boolean {
  return set.planItemId != null ? set.planItemId === item.id : set.exerciseId === item.exerciseId && plan.findIndex((p) => p.exerciseId === item.exerciseId) === index;
}

export function setAtPosition<T extends { position?: number }>(sets: T[], position: number): T | undefined {
  return sets.find((s) => s.position === position) ?? sets.filter((s) => s.position == null)[position];
}
