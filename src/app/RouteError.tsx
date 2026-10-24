import { isRouteErrorResponse, useRouteError } from 'react-router';

export function RouteError() {
  const err = useRouteError();
  const msg = isRouteErrorResponse(err) ? `${err.status} ${err.statusText}` : err instanceof Error ? err.message : String(err);
  // 部署新版後舊的分頁可能載不到已刪除的 chunk：重新整理即可
  const chunk = /dynamically imported module|Failed to fetch|Importing a module script failed/i.test(msg);
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-6">
      <h1 className="text-h2 font-semibold">{chunk ? 'App 已更新' : '發生錯誤'}</h1>
      <p className="text-chalk-2">{chunk ? '請重新整理以載入新版本。你的資料都還在。' : '這個畫面出了問題，你的資料不受影響。'}</p>
      {!chunk && <pre className="overflow-x-auto rounded-md bg-iron p-3 text-sm whitespace-pre-wrap text-chalk-3">{msg}</pre>}
      <button type="button" className="press h-11 rounded-md bg-chalk font-semibold text-on-chalk" onClick={() => location.reload()}>
        重新整理
      </button>
    </div>
  );
}
