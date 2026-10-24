// 線條圖示（24 格、1.75 線寬）。只放實際用到的。

const PATHS = {
  home: 'M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z',
  dumbbell: 'M3 9.5v5M6 7v10M6 12h12M18 7v10M21 9.5v5',
  bowl: 'M3.5 11h17a8.5 8.5 0 0 1-17 0ZM8 7.5c0-1.5 1-1.5 1-3M12 7.5c0-1.5 1-1.5 1-3M16 7.5c0-1.5 1-1.5 1-3',
  body: 'M12 6.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM5 9.5l7 1 7-1M12 10.5v4.5M9 21l3-6 3 6',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  check: 'm5 12.5 4.5 4.5L19 7.5',
  x: 'M6 6l12 12M18 6 6 18',
  chevronRight: 'm9 5 7 7-7 7',
  chevronLeft: 'm15 5-7 7 7 7',
  chevronDown: 'm5 9 7 7 7-7',
  timer: 'M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM12 9v4l2.5 2.5M9.5 2.5h5',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  edit: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM20 20l-4-4',
  settings:
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19.4 13.5l1.6 1.2-2 3.4-1.9-.7a7.6 7.6 0 0 1-2.1 1.2l-.3 2h-4l-.3-2a7.6 7.6 0 0 1-2.1-1.2l-1.9.7-2-3.4 1.6-1.2a7.6 7.6 0 0 1 0-3L2.4 9.3l2-3.4 1.9.7a7.6 7.6 0 0 1 2.1-1.2l.3-2h4l.3 2a7.6 7.6 0 0 1 2.1 1.2l1.9-.7 2 3.4-1.6 1.2a7.6 7.6 0 0 1 0 3Z',
  download: 'M12 4v11M7 10.5l5 4.5 5-4.5M5 20h14',
  upload: 'M12 15V4M7 8.5 12 4l5 4.5M5 20h14',
  chart: 'M4 20V4M4 20h16M8 16l4-5 3 3 5-7',
  flame: 'M12 21c3.9 0 6.5-2.6 6.5-6.3 0-3.2-2.1-5.6-4-7.7-.4 2-1.5 3.2-2.7 3.7.3-2.6-.7-5.4-3-7.2C8.6 7 5.5 9.6 5.5 14.7 5.5 18.4 8.1 21 12 21Z',
  drop: 'M12 3.5s-6 6.6-6 11a6 6 0 0 0 12 0c0-4.4-6-11-6-11Z',
  scale: 'M4 6h16v14H4zM9 10a3 3 0 0 1 6 0M12 10l1.2-1.6',
  calc: 'M6 3h12v18H6zM9 7h6M9 12h.01M12 12h.01M15 12h.01M9 16h.01M12 16h.01M15 16h.01',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 11v5M12 8h.01',
  copy: 'M9 9h11v11H9zM5 15V4h11',
  history: 'M4 12a8 8 0 1 0 2.3-5.7M4 4v4h4M12 8v4l3 2',
  play: 'M8 5.5v13l10-6.5z',
  pause: 'M8 5v14M16 5v14',
  star: 'm12 4 2.5 5 5.5.8-4 3.9.9 5.5L12 16.6 7.1 19.2l.9-5.5-4-3.9 5.5-.8z',
  swap: 'M7 7h13M16 3l4 4-4 4M17 17H4M8 13l-4 4 4 4',
  note: 'M5 4h10l4 4v12H5zM14 4v5h5M8 13h8M8 17h5',
  run: 'M13.5 5.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM7 21l3.5-6 3 2.5V22M6 11l3-3h4l2 4 3 1M10.5 15l1-4',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 20, className = '', strokeWidth = 1.75 }: { name: IconName; size?: number; className?: string; strokeWidth?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
