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

// ---------- Round 2 列舉（core 與 db 共用） ----------

/** 痠痛部位：比肌群粗，新手比較好選 */
export const SORE_AREAS = ['chest', 'shoulders', 'upperBack', 'arms', 'abs', 'lowerBack', 'glutes', 'quads', 'hamstrings', 'calves'] as const;
export type SoreArea = (typeof SORE_AREAS)[number];
export const SORE_AREA_LABEL: Record<SoreArea, string> = {
  chest: '胸',
  shoulders: '肩',
  upperBack: '上背',
  arms: '手臂',
  abs: '腹',
  lowerBack: '下背',
  glutes: '臀',
  quads: '大腿前側',
  hamstrings: '大腿後側',
  calves: '小腿',
};

export const GOAL_TYPES = ['bodyweight', 'lift', 'bodyFat', 'circ', 'custom'] as const;
export type GoalKind = (typeof GOAL_TYPES)[number];
export const GOAL_TYPE_LABEL: Record<GoalKind, string> = {
  bodyweight: '體重',
  lift: '動作重量',
  bodyFat: '體脂率',
  circ: '圍度',
  custom: '自訂',
};

/** 習慣的判定方式：manual 手動打卡，其他由當天資料自動判定 */
export const HABIT_RULES = ['manual', 'weighIn', 'protein', 'water', 'sleep', 'workout', 'logFood', 'supplement'] as const;
export type HabitRule = (typeof HABIT_RULES)[number];
export const HABIT_RULE_LABEL: Record<HabitRule, string> = {
  manual: '手動打卡',
  weighIn: '量體重',
  protein: '蛋白質達標',
  water: '喝水達標',
  sleep: '睡滿目標時數',
  workout: '完成一場訓練',
  logFood: '記錄飲食',
  supplement: '補給品打卡',
};

export const PRODUCT_KINDS = ['supplement', 'gear'] as const;
export type ProductKind = (typeof PRODUCT_KINDS)[number];

export const SUPPLEMENT_CATEGORIES = ['protein', 'creatine', 'caffeine', 'vitamin', 'omega3', 'other'] as const;
export const GEAR_CATEGORIES = ['belt', 'shoes', 'straps', 'wraps', 'sleeves', 'gloves', 'chalk', 'band', 'gearOther'] as const;
export const PRODUCT_CATEGORIES = [...SUPPLEMENT_CATEGORIES, ...GEAR_CATEGORIES] as const;
export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];
export const PRODUCT_CATEGORY_LABEL: Record<ProductCategory, string> = {
  protein: '蛋白粉',
  creatine: '肌酸',
  caffeine: '咖啡因',
  vitamin: '維生素／礦物質',
  omega3: '魚油',
  other: '其他補給品',
  belt: '舉重腰帶',
  shoes: '訓練鞋',
  straps: '助握帶',
  wraps: '護腕／綁帶',
  sleeves: '護膝',
  gloves: '手套',
  chalk: '止滑粉',
  band: '彈力帶',
  gearOther: '其他裝備',
};

export const PRODUCT_STATUSES = ['using', 'candidate', 'finished'] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];
export const PRODUCT_STATUS_LABEL: Record<ProductStatus, string> = {
  using: '使用中',
  candidate: '考慮中',
  finished: '已用完',
};

export const PHOTO_POSES = ['front', 'side', 'back', 'other'] as const;
export type PhotoPose = (typeof PHOTO_POSES)[number];
export const PHOTO_POSE_LABEL: Record<PhotoPose, string> = {
  front: '正面',
  side: '側面',
  back: '背面',
  other: '其他',
};
