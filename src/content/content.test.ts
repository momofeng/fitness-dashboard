// 內建內容的品質把關：格式、唯一性、引用完整、課表訓練量合理。

import { describe, expect, it } from 'vitest';
import { customExerciseSchema } from '../db/schemas';
import { programWeeklyVolume } from '../core/training/volume';
import { EXERCISES } from './exercises';
import { PROGRAM_TEMPLATES } from './programTemplates';
import { MUSCLES, type Muscle } from './types';

const byId = new Map(EXERCISES.map((e) => [e.id, e]));

describe('動作庫', () => {
  it('至少 100 個動作', () => expect(EXERCISES.length).toBeGreaterThanOrEqual(100));

  it('每筆都符合自建動作的 schema', () => {
    for (const e of EXERCISES) {
      const r = customExerciseSchema.safeParse({ ...e, updatedAt: 0 });
      expect(r.success, `${e.id}: ${r.success ? '' : r.error.message}`).toBe(true);
    }
  });

  it('id 唯一且為 kebab-case', () => {
    expect(new Set(EXERCISES.map((e) => e.id)).size).toBe(EXERCISES.length);
    for (const e of EXERCISES) expect(e.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it('中文名稱唯一', () => {
    expect(new Set(EXERCISES.map((e) => e.nameZh)).size).toBe(EXERCISES.length);
  });

  it('次數區間合理', () => {
    for (const e of EXERCISES) {
      const [lo, hi] = e.defaultRepRange;
      expect(lo, e.id).toBeLessThanOrEqual(hi);
    }
  });

  it.each(MUSCLES)('肌群 %s 至少 4 個主要動作', (m) => {
    expect(EXERCISES.filter((e) => e.primary.includes(m)).length).toBeGreaterThanOrEqual(4);
  });

  it('不含健身常見的簡體字', () => {
    // 只列繁體不使用的簡體字（划、械等繁簡同形字不列）
    const simplified = /[杠铃哑练卧举弯压侧绳飞鸟机稳脚轻]/u;
    for (const e of EXERCISES) {
      const text = e.nameZh + e.aliases.join('') + e.cues;
      expect(simplified.test(text), `${e.id}: ${e.nameZh}`).toBe(false);
    }
  });
});

describe('課表範本', () => {
  it('引用的動作都存在', () => {
    for (const t of PROGRAM_TEMPLATES) {
      for (const d of t.days) {
        for (const s of d.slots) expect(byId.has(s.exerciseId), `${t.id}/${d.id}: ${s.exerciseId}`).toBe(true);
      }
    }
  });

  it('linear 的 repMin === repMax；其他 repMin <= repMax', () => {
    for (const t of PROGRAM_TEMPLATES) {
      for (const d of t.days) {
        for (const s of d.slots) {
          if (s.progression === 'linear') expect(s.repMin, s.exerciseId).toBe(s.repMax);
          else expect(s.repMin, s.exerciseId).toBeLessThanOrEqual(s.repMax);
        }
      }
    }
  });

  const MAJOR: Muscle[] = ['chest', 'lats', 'upperBack', 'quads', 'hamstrings', 'glutes'];

  it.each(PROGRAM_TEMPLATES.map((t) => [t.id, t] as const))('%s：主要肌群每週組數 8–22', (_id, t) => {
    const vol = programWeeklyVolume(t, (id) => byId.get(id));
    for (const m of MAJOR) {
      expect(vol[m], `${t.id} ${m}=${vol[m]}`).toBeGreaterThanOrEqual(8);
      expect(vol[m], `${t.id} ${m}=${vol[m]}`).toBeLessThanOrEqual(22);
    }
  });
});
