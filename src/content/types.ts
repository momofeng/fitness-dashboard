// 內建內容（動作庫、課表範本）的型別與列舉。內容放在程式裡，不寫進 DB。

export const MUSCLES = [
  'chest',
  'frontDelt',
  'sideDelt',
  'rearDelt',
  'lats',
  'upperBack',
  'biceps',
  'triceps',
  'forearms',
  'quads',
  'hamstrings',
  'glutes',
  'calves',
  'abs',
  'lowerBack',
] as const;
export type Muscle = (typeof MUSCLES)[number];

export const MUSCLE_LABEL: Record<Muscle, string> = {
  chest: '胸',
  frontDelt: '前三角',
  sideDelt: '側三角',
  rearDelt: '後三角',
  lats: '背闊',
  upperBack: '上背',
  biceps: '二頭',
  triceps: '三頭',
  forearms: '前臂',
  quads: '股四頭',
  hamstrings: '腿後',
  glutes: '臀',
  calves: '小腿',
  abs: '腹',
  lowerBack: '下背',
};

export const EQUIPMENT = [
  'barbell',
  'dumbbell',
  'machine',
  'cable',
  'smith',
  'ezbar',
  'kettlebell',
  'bodyweight',
  'band',
  'other',
] as const;
export type Equipment = (typeof EQUIPMENT)[number];

export const EQUIPMENT_LABEL: Record<Equipment, string> = {
  barbell: '槓鈴',
  dumbbell: '啞鈴',
  machine: '器械',
  cable: '滑輪',
  smith: '史密斯',
  ezbar: 'EZ 槓',
  kettlebell: '壺鈴',
  bodyweight: '徒手',
  band: '彈力帶',
  other: '其他',
};

/**
 * 負荷怎麼算：
 * - external：只算器材重量
 * - bodyweightPlus：體重 + 附加重量（引體、雙槓撐體）
 * - assisted：體重 − 輔助重量（輔助引體機）
 * - bodyweight：純徒手，以次數為主（伏地挺身、懸垂抬腿）
 */
export const LOAD_TYPES = ['external', 'bodyweightPlus', 'assisted', 'bodyweight'] as const;
export type LoadType = (typeof LOAD_TYPES)[number];

export type ExerciseCategory = 'compound' | 'isolation';

export interface Exercise {
  /** kebab-case slug，內建動作永久不改 */
  id: string;
  nameZh: string;
  /** 台灣健身房常見的其他叫法，供搜尋 */
  aliases: string[];
  nameEn: string;
  primary: Muscle[];
  secondary: Muscle[];
  equipment: Equipment;
  category: ExerciseCategory;
  loadType: LoadType;
  /** 線性／雙重進步每次加重的預設值（kg） */
  defaultIncrementKg: number;
  defaultRepRange: [number, number];
  /** 1–2 句繁中動作要點 */
  cues: string;
}

export type ProgressionKind = 'linear' | 'double' | 'none';

export interface ProgramSlot {
  exerciseId: string;
  sets: number;
  repMin: number;
  /** linear 時 repMin === repMax（固定目標次數） */
  repMax: number;
  restSec: number;
  progression: ProgressionKind;
  /** 覆寫動作預設加重量 */
  incrementKg?: number;
  /** 同編號的相鄰動作為超級組 */
  supersetGroup?: number;
  note?: string;
}

export interface ProgramDay {
  id: string;
  name: string;
  slots: ProgramSlot[];
}

export interface ProgramTemplate {
  id: string;
  name: string;
  level: 'novice' | 'intermediate';
  daysPerWeek: number;
  description: string;
  /** 依序輪替的訓練日，例如 A/B 交替 */
  days: ProgramDay[];
}
