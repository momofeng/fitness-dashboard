// 依使用者單位決定槓片示意要用的槓重、槓片與級距（磅制用 lb 槓片，EZ 槓用自己的槓重）。

import type { Equipment } from '../../content/types';
import type { PlateStock } from '../../core/training/strength';
import { kgToLb, lbToKg, roundTo, type WeightUnit } from '../../core/units';
import { barKgFor, smallestPlateKg, smallestPlateLb } from '../../db/defaults';
import type { Settings } from '../../db/schemas';

export interface PlateSetup {
  unit: WeightUnit;
  /** 槓重（使用者單位） */
  bar: number;
  /** 可用槓片（數值是使用者單位） */
  stock: PlateStock[];
  /** 槓鈴類的最小變化量（使用者單位） */
  step: number;
  toUnit: (kg: number) => number;
  fromUnit: (v: number) => number;
}

export const BARBELL_EQUIPMENT = new Set<Equipment>(['barbell', 'smith', 'ezbar']);

export function plateSetup(s: Settings, equipment: Equipment = 'barbell'): PlateSetup {
  if (s.units.weight === 'lb') {
    return {
      unit: 'lb',
      bar: equipment === 'ezbar' ? roundTo(kgToLb(s.equipment.ezBarKg), 0.5) : s.equipment.barLb,
      stock: s.equipment.platesLb.map((p) => ({ kg: p.lb, pairs: p.pairs })),
      step: smallestPlateLb(s) * 2,
      toUnit: (kg) => Number(kgToLb(kg).toFixed(2)),
      fromUnit: lbToKg,
    };
  }
  return {
    unit: 'kg',
    bar: barKgFor(s, equipment),
    stock: s.equipment.plates,
    step: smallestPlateKg(s) * 2,
    toUnit: (kg) => kg,
    fromUnit: (v) => v,
  };
}
