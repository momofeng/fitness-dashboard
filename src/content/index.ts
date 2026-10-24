import { EXERCISES } from './exercises';
import type { Exercise } from './types';

const BY_ID = new Map(EXERCISES.map((e) => [e.id, e]));

export function getBuiltinExercise(id: string): Exercise | undefined {
  return BY_ID.get(id);
}

export { EXERCISES };
export * from './types';
export { PROGRAM_TEMPLATES, DEFAULT_TEMPLATE_ID, getTemplate } from './programTemplates';

export const CARDIO_TYPES = ['快走', '慢跑', '飛輪', '划船機', '橢圓機', '爬坡跑步機', '游泳', '跳繩', '球類', '其他'] as const;
