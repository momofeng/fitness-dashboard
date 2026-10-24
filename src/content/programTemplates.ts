// 課表範本。選用後會複製一份到使用者的 programs 表，之後可自由修改。
// 主項（linear）固定目標次數，達標就加重；輔助動作（double）在次數區間內先加次數再加重。

import type { ProgramSlot, ProgramTemplate } from './types';

const lin = (exerciseId: string, sets: number, reps: number, restSec = 180, extra: Partial<ProgramSlot> = {}): ProgramSlot => ({
  exerciseId,
  sets,
  repMin: reps,
  repMax: reps,
  restSec,
  progression: 'linear',
  ...extra,
});

const dbl = (exerciseId: string, sets: number, repMin: number, repMax: number, restSec = 90, extra: Partial<ProgramSlot> = {}): ProgramSlot => ({
  exerciseId,
  sets,
  repMin,
  repMax,
  restSec,
  progression: 'double',
  ...extra,
});

export const PROGRAM_TEMPLATES: ProgramTemplate[] = [
  {
    id: 'novice-fullbody-barbell',
    name: '新手全身 A/B（槓鈴）',
    level: 'novice',
    daysPerWeek: 3,
    description:
      '每週 3 天、A/B 輪替（例：一三五）。主項深蹲、臥推、划船、硬舉、肩推用線性進步，每次達標就加重；輔助動作用雙重進步。適合訓練未滿一年、想打好基礎動作的人。',
    days: [
      {
        id: 'A',
        name: '全身 A',
        slots: [
          lin('barbell-back-squat', 3, 6),
          lin('barbell-bench-press', 3, 6),
          lin('barbell-row', 3, 6, 150),
          dbl('lying-leg-curl', 2, 10, 15),
          dbl('dumbbell-lateral-raise', 3, 12, 15, 60),
          dbl('rope-triceps-pushdown', 2, 10, 15, 60),
          dbl('cable-crunch', 2, 10, 15, 60),
        ],
      },
      {
        id: 'B',
        name: '全身 B',
        slots: [
          lin('barbell-deadlift', 2, 5, 180, { incrementKg: 5 }),
          lin('barbell-overhead-press', 3, 6),
          dbl('lat-pulldown', 3, 8, 12, 120),
          dbl('incline-dumbbell-press', 3, 8, 12, 120),
          dbl('leg-press', 3, 10, 15, 120),
          dbl('face-pull', 2, 12, 15, 60),
          dbl('dumbbell-curl', 2, 10, 15, 60),
        ],
      },
    ],
  },
  {
    id: 'novice-fullbody-machine',
    name: '新手全身 A/B（啞鈴／器械）',
    level: 'novice',
    daysPerWeek: 3,
    description:
      '每週 3 天、A/B 輪替。全部用器械、滑輪與啞鈴，動作容易上手、受傷風險低，適合還不熟悉槓鈴的人。全部採雙重進步：每組都做到次數上限再加重。',
    days: [
      {
        id: 'A',
        name: '全身 A',
        slots: [
          dbl('leg-press', 3, 8, 12, 150),
          dbl('machine-chest-press', 3, 8, 12, 120),
          dbl('seated-cable-row', 3, 8, 12, 120),
          dbl('seated-leg-curl', 3, 10, 15, 90),
          dbl('dumbbell-lateral-raise', 3, 12, 15, 60),
          dbl('rope-triceps-pushdown', 2, 10, 15, 60),
        ],
      },
      {
        id: 'B',
        name: '全身 B',
        slots: [
          dbl('dumbbell-romanian-deadlift', 3, 8, 12, 120),
          dbl('dumbbell-shoulder-press', 3, 8, 12, 120),
          dbl('lat-pulldown', 3, 8, 12, 120),
          dbl('incline-dumbbell-press', 3, 8, 12, 120),
          dbl('bulgarian-split-squat', 3, 8, 12, 90),
          dbl('face-pull', 2, 12, 15, 60),
          dbl('dumbbell-curl', 2, 10, 15, 60),
          dbl('cable-crunch', 2, 10, 15, 60),
        ],
      },
    ],
  },
  {
    id: 'upper-lower-4',
    name: '上下肢分化（4 天）',
    level: 'intermediate',
    daysPerWeek: 4,
    description:
      '每週 4 天：上肢 A、下肢 A、休息、上肢 B、下肢 B。每個肌群一週練兩次，訓練量比全身課表高。新手線性進步停滯後的下一步。',
    days: [
      {
        id: 'UA',
        name: '上肢 A',
        slots: [
          dbl('barbell-bench-press', 4, 5, 8, 180),
          dbl('barbell-row', 4, 6, 10, 150),
          dbl('dumbbell-shoulder-press', 3, 8, 12, 120),
          dbl('lat-pulldown', 3, 8, 12, 120),
          dbl('dumbbell-lateral-raise', 3, 12, 15, 60),
          dbl('ez-bar-curl', 2, 10, 12, 60, { supersetGroup: 1 }),
          dbl('rope-triceps-pushdown', 2, 10, 12, 60, { supersetGroup: 1 }),
        ],
      },
      {
        id: 'LA',
        name: '下肢 A',
        slots: [
          dbl('barbell-back-squat', 4, 5, 8, 180),
          dbl('romanian-deadlift', 3, 6, 10, 150),
          dbl('leg-press', 3, 10, 15, 120),
          dbl('lying-leg-curl', 3, 10, 15, 90),
          dbl('standing-calf-raise', 4, 10, 15, 60),
        ],
      },
      {
        id: 'UB',
        name: '上肢 B',
        slots: [
          dbl('incline-dumbbell-press', 3, 8, 12, 120),
          dbl('chest-supported-row', 3, 8, 12, 120),
          dbl('close-grip-lat-pulldown', 3, 8, 12, 120),
          dbl('cable-fly', 3, 12, 15, 60),
          dbl('face-pull', 3, 12, 15, 60),
          dbl('hammer-curl', 2, 10, 12, 60, { supersetGroup: 1 }),
          dbl('overhead-cable-triceps-extension', 2, 10, 12, 60, { supersetGroup: 1 }),
        ],
      },
      {
        id: 'LB',
        name: '下肢 B',
        slots: [
          dbl('barbell-deadlift', 3, 4, 6, 180, { incrementKg: 5 }),
          dbl('bulgarian-split-squat', 3, 8, 12, 90),
          dbl('leg-extension', 3, 10, 15, 60),
          dbl('seated-leg-curl', 3, 10, 15, 60),
          dbl('seated-calf-raise', 3, 10, 15, 60),
          dbl('hanging-leg-raise', 3, 10, 15, 60),
        ],
      },
    ],
  },
  {
    id: 'ppl-6',
    name: '推拉腿 PPL（6 天）',
    level: 'intermediate',
    daysPerWeek: 6,
    description:
      '推、拉、腿各練兩次，每週 6 天、休息 1 天。訓練量最高，需要足夠的睡眠與熱量；時間不夠時可以改成每週 3 天只跑一輪。',
    days: [
      {
        id: 'PA',
        name: '推 A',
        slots: [
          dbl('barbell-bench-press', 4, 5, 8, 180),
          dbl('dumbbell-shoulder-press', 3, 8, 12, 120),
          dbl('incline-dumbbell-press', 3, 8, 12, 120),
          dbl('dumbbell-lateral-raise', 4, 12, 15, 60),
          dbl('rope-triceps-pushdown', 3, 10, 15, 60),
        ],
      },
      {
        id: 'LA',
        name: '拉 A',
        slots: [
          dbl('barbell-row', 4, 6, 10, 150),
          dbl('lat-pulldown', 3, 8, 12, 120),
          dbl('face-pull', 3, 12, 15, 60),
          dbl('ez-bar-curl', 3, 8, 12, 60),
          dbl('hammer-curl', 2, 10, 15, 60),
        ],
      },
      {
        id: 'GA',
        name: '腿 A',
        slots: [
          dbl('barbell-back-squat', 4, 5, 8, 180),
          dbl('romanian-deadlift', 3, 8, 10, 150),
          dbl('leg-press', 3, 10, 15, 120),
          dbl('lying-leg-curl', 3, 10, 15, 90),
          dbl('standing-calf-raise', 4, 10, 15, 60),
        ],
      },
      {
        id: 'PB',
        name: '推 B',
        slots: [
          dbl('barbell-overhead-press', 4, 5, 8, 180),
          dbl('incline-barbell-bench-press', 3, 6, 10, 150),
          dbl('cable-fly', 3, 12, 15, 60),
          dbl('cable-lateral-raise', 3, 12, 15, 60),
          dbl('overhead-cable-triceps-extension', 3, 10, 15, 60),
        ],
      },
      {
        id: 'LB',
        name: '拉 B',
        slots: [
          dbl('pull-up', 3, 6, 10, 150),
          dbl('chest-supported-row', 3, 8, 12, 120),
          dbl('one-arm-dumbbell-row', 3, 8, 12, 90),
          dbl('reverse-pec-deck', 3, 12, 15, 60),
          dbl('incline-dumbbell-curl', 3, 10, 12, 60),
        ],
      },
      {
        id: 'GB',
        name: '腿 B',
        slots: [
          dbl('barbell-deadlift', 3, 4, 6, 180, { incrementKg: 5 }),
          dbl('hack-squat', 3, 8, 12, 120),
          dbl('bulgarian-split-squat', 3, 8, 12, 90),
          dbl('seated-leg-curl', 3, 10, 15, 60),
          dbl('seated-calf-raise', 3, 12, 15, 60),
          dbl('cable-crunch', 3, 10, 15, 60),
        ],
      },
    ],
  },
];

export const DEFAULT_TEMPLATE_ID = 'novice-fullbody-barbell';

export function getTemplate(id: string): ProgramTemplate | undefined {
  return PROGRAM_TEMPLATES.find((t) => t.id === id);
}
