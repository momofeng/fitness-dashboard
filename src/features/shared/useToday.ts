import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ageFromBirthYear, todayKey } from '../../core/dates';
import { macroTargets, type MacroTargets } from '../../core/nutrition';
import { latestWeightKg } from '../../db/repo/body';
import { useSettings } from '../../db/repo/settings';
import type { Settings } from '../../db/schemas';

/** 依日切換時間算出「今天」，每分鐘與回到前景時更新 */
export function useToday(cutoffHour: number | undefined): string {
  const [key, setKey] = useState(() => todayKey(cutoffHour ?? 4));
  useEffect(() => {
    const update = () => setKey(todayKey(cutoffHour ?? 4));
    update();
    const t = setInterval(update, 60_000);
    document.addEventListener('visibilitychange', update);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', update);
    };
  }, [cutoffHour]);
  return key;
}

export function computeTargets(s: Settings, weightKg: number, today: string): MacroTargets {
  return macroTargets(
    {
      sex: s.profile.sex,
      weightKg,
      heightCm: s.profile.heightCm,
      age: ageFromBirthYear(s.profile.birthYear, today),
      activity: s.profile.activity,
    },
    s.nutrition,
  );
}

/** 目前的熱量與巨量目標；沒有體重紀錄時回傳 null */
export function useTargets(): { targets: MacroTargets | null; weightKg: number | null; settings: Settings | undefined; today: string } {
  const settings = useSettings();
  const today = useToday(settings?.dayCutoffHour);
  const weightKg = useLiveQuery(latestWeightKg, []) ?? null;
  const targets = settings && weightKg ? computeTargets(settings, weightKg, today) : null;
  return { targets, weightKg, settings, today };
}
