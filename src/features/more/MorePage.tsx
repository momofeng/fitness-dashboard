import { useSettings } from '../../db/repo/settings';
import { Icon, type IconName } from '../../ui/Icon';
import { ListRow, PageHeader, Section } from '../../ui/Layout';

const GROUPS: Array<{ title: string; items: Array<{ to: string; icon: IconName; label: string; sub: string }> }> = [
  {
    title: '訓練',
    items: [
      { to: '/train/program', icon: 'note', label: '課表', sub: '選擇或編輯課表' },
      { to: '/train/exercises', icon: 'dumbbell', label: '動作庫', sub: '125 個動作與自建動作' },
      { to: '/train/history', icon: 'history', label: '訓練紀錄', sub: '每一場的組數與重量' },
      { to: '/train/cardio', icon: 'run', label: '有氧紀錄', sub: '快走、慢跑、飛輪…' },
    ],
  },
  {
    title: '飲食',
    items: [
      { to: '/eat/foods', icon: 'bowl', label: '我的食物與餐點組合', sub: '自建食物、超商品項、常吃組合' },
      { to: '/eat/week', icon: 'chart', label: '每週營養摘要', sub: '平均攝取與目標比較' },
    ],
  },
  {
    title: '工具與設定',
    items: [
      { to: '/tools', icon: 'calc', label: '小工具', sub: '1RM、槓片、暖身組、TDEE' },
      { to: '/settings', icon: 'settings', label: '設定', sub: '個人資料、營養目標、器材' },
      { to: '/settings/data', icon: 'download', label: '資料與備份', sub: '匯出、還原、CSV' },
      { to: '/about', icon: 'info', label: '關於與資料來源', sub: '授權聲明、免責說明' },
    ],
  },
];

export default function MorePage() {
  const s = useSettings();
  return (
    <div className="flex flex-col gap-6 pb-4">
      <PageHeader title="更多" sub={s?.profile.name ? `${s.profile.name}，加油！` : undefined} />
      {GROUPS.map((g) => (
        <Section key={g.title} title={g.title}>
          <div className="card divide-y divide-seam overflow-hidden">
            {g.items.map((i) => (
              <ListRow key={i.to} to={i.to}>
                <span className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-iron-2 text-chalk-2">
                    <Icon name={i.icon} size={18} />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-medium">{i.label}</span>
                    <span className="block truncate text-sm text-chalk-3">{i.sub}</span>
                  </span>
                </span>
              </ListRow>
            ))}
          </div>
        </Section>
      ))}
      <p className="text-center text-cap text-chalk-4">版本 {__APP_VERSION__} · Round 2 將加入補給品選品、恢復、進度照</p>
    </div>
  );
}
