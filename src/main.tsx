import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router/dom';
import { router } from './app/routes';
import { onVersionChange } from './db/db';
import { initServiceWorker } from './lib/swUpdate';
import { toast } from './ui/toast';
import './styles/app.css';

// 另一個分頁升級了資料庫：舊連線已關閉，請使用者重新整理（不用原生 alert，避免卡住）
onVersionChange(() => {
  toast('App 已在另一個分頁更新，請重新整理此頁。', { actionLabel: '重新整理', onAction: () => location.reload(), ms: 600_000 });
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);

void initServiceWorker();
