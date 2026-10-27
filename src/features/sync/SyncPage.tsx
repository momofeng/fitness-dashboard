import { canonical } from '../../core/syncMerge';
import { RecordSummary, conflictTitle } from './RecordSummary';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import qrcode from 'qrcode-generator';
import { DEFAULT_SYNC_ENDPOINT } from '../../sync/config';
import { getSyncCredential, type SyncCredential } from '../../sync/local';
import { SYNC_LABEL, useSyncStatus } from '../../sync/status';
import { createSyncSpace, inspectSyncSpace, joinSyncSpace, syncNow, resolveSyncConflicts, makePairingCode, claimPairingCode, listSyncVersions, restoreSyncVersion, disconnectSync } from '../../sync/engine';
import { BACKUP_SPECS, BACKUP_TABLES } from '../../db/backup/tables';
import type { BackupFile } from '../../db/backup/backup';
import { useSettings } from '../../db/repo/settings';
import { Button } from '../../ui/Button';
import { Field, TextField } from '../../ui/Fields';
import { PageHeader, Section } from '../../ui/Layout';
import { Sheet } from '../../ui/Sheet';
import { toast } from '../../ui/toast';
import { PairingScanner } from './PairingScanner';

type Preview = { credential: SyncCredential; data: BackupFile; revision: number };
export default function SyncPage() {
  const settings = useSettings();
  const status = useSyncStatus();
  const [credential, setCredential] = useState(getSyncCredential);
  const [endpoint, setEndpoint] = useState(credential?.endpoint ?? DEFAULT_SYNC_ENDPOINT);
  const [input, setInput] = useState('');
  const [joinOpen, setJoinOpen] = useState(false);
  const [reveal, setReveal] = useState(false);
  const [keyOpen, setKeyOpen] = useState(false);
  const [keySaved, setKeySaved] = useState(false);
  const [pair, setPair] = useState<{ code: string; expiresAt: number } | null>(null);
  const [now, setNow] = useState(Date.now());
  const [scan, setScan] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [choices, setChoices] = useState<Record<string, 'local' | 'remote'>>({});
  const [versions, setVersions] = useState<Array<{ revision: number; createdAt: number }> | null>(null);
  const [restore, setRestore] = useState<number | null>(null);
  const [stopOpen, setStopOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const update = () => setCredential(getSyncCredential());
    window.addEventListener('fitness-sync-credential', update);
    const storage = () => update(); window.addEventListener('storage', storage);
    return () => { window.removeEventListener('fitness-sync-credential', update); window.removeEventListener('storage', storage); };
  }, []);
  useEffect(() => { if (!pair) return; const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, [pair]);
  const conflictVersion = canonical({ revision: status.revision, conflicts: status.conflicts });
  useEffect(() => setChoices({}), [conflictVersion]);
  const qr = useMemo(() => { if (!pair) return ''; const code = qrcode(0, 'M'); code.addData(pair.code, 'Byte'); code.make(); return code.createDataURL(5, 20); }, [pair]);
  async function run(fn: () => Promise<void>) {
    if (busyRef.current) return; busyRef.current = true; setBusy(true); setError('');
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : '操作失敗，請重試'); }
    finally { busyRef.current = false; setBusy(false); }
  }
  async function inspect(value = input) {
    await run(async () => { const result = value.trim().startsWith('PAIR1.') ? await claimPairingCode(value, endpoint) : await inspectSyncSpace(value, endpoint); setPreview(result); setJoinOpen(false); setInput(''); });
  }
  async function copy(value: string) { try { await navigator.clipboard.writeText(value); toast('已複製，請只保存到自己的安全位置'); } catch { toast('無法自動複製，請長按欄位手動複製'); } }
  return <div className="mx-auto flex max-w-2xl flex-col gap-6 pb-8">
    <PageHeader title="加密雲端同步" back={settings?.onboarded ? '/settings/data' : '/onboarding'} sub="免帳號 · 恢復金鑰 · 離線可記錄" />
    {import.meta.env.DEV && <p className="rounded-md bg-warn-soft p-3 text-sm text-warn">目前為本機預覽，使用本機同步服務；正式雲端需完成發布後才能跨手機使用。</p>}
    <div className="card flex flex-col gap-3 p-4">
      <p className="text-h3 font-semibold">{credential ? SYNC_LABEL[status.phase] : '用一組金鑰連接自己的裝置'}</p>
      <p className="text-sm text-chalk-2">同步訓練、飲食、身體數據與課表。資料先在裝置加密再上傳，只有持有恢復金鑰的人能解密。</p>
      <p className="text-sm text-chalk-3">進行中的訓練與草稿留在原裝置，完成後同步。進度照、AI API 金鑰與裝置偏好不會同步，進度照仍需完整 ZIP 備份。</p>
      {credential && <><p className="num text-sm text-chalk-3">最後成功：{status.lastSuccessAt ? new Date(status.lastSuccessAt).toLocaleString('zh-TW') : '尚未完成'}{status.revision ? ' · 版本 ' + status.revision : ''}</p>
        <Button variant="primary" block disabled={busy || status.phase === 'syncing'} onClick={() => void run(async () => { await syncNow(); })}>立即同步</Button></>}
    </div>
    {(error || status.error) && <p role="alert" className="rounded-md bg-warn-soft p-3 text-sm text-warn">{error || status.error}</p>}
    {!credential ? <>
      <Section title="第一次使用"><div className="card flex flex-col gap-3 p-4">
        <p className="text-sm text-chalk-2">在目前有紀錄的裝置建立同步空間，再把恢復金鑰保存在密碼管理工具或離線安全位置。</p>
        <Button variant="primary" size="lg" block disabled={busy || !settings?.onboarded} onClick={() => void run(async () => { await createSyncSpace(endpoint); setKeyOpen(true); setReveal(true); setKeySaved(false); })}>{busy ? '建立中…' : '建立同步空間'}</Button>
        {!settings?.onboarded && <p className="text-sm text-chalk-3">新裝置請用下方金鑰加入；首次使用請先完成基本設定。</p>}
      </div></Section>
      <Section title="已有其他裝置"><div className="card flex flex-col gap-3 p-4">
        <Button size="lg" block disabled={busy} onClick={() => setJoinOpen(true)}>輸入恢復金鑰或配對碼</Button>
        <Button block disabled={busy} onClick={() => setScan(true)}>掃描舊裝置的限時 QR 碼</Button>
      </div></Section>
      <details><summary className="press min-h-11 cursor-pointer py-2 text-sm text-chalk-3">進階：同步服務位址</summary><TextField label="同步服務位址" value={endpoint} onChange={(e) => setEndpoint(e.target.value)} spellCheck={false} /></details>
    </> : <>
      {status.conflicts?.length ? <Section title={'需要確認 ' + status.conflicts.length + ' 項'}>
        <p className="mb-3 text-sm text-chalk-2">兩台裝置修改了相同紀錄，尚未覆蓋任何一邊。選擇後會先下載一份本機備份，再套用並同步。</p>
        <div className="flex flex-col gap-3">{status.conflicts.map((c) => <fieldset className="card min-w-0 p-4" key={c.id}>
          <legend className="max-w-full break-words px-1 text-sm font-semibold">{BACKUP_SPECS[c.table as keyof typeof BACKUP_SPECS]?.label ?? c.table} · {conflictTitle(c.local ?? c.remote)}</legend>
          <div className="grid gap-3 sm:grid-cols-2">{(['local', 'remote'] as const).map((source) => <label className={'flex min-w-0 cursor-pointer flex-col gap-2 rounded-md border p-3 ' + (choices[c.id] === source ? 'border-chalk' : 'border-seam')} key={source}>
            <span className="flex min-h-11 items-center gap-2"><input type="radio" name={c.id} checked={choices[c.id] === source} onChange={() => setChoices({ ...choices, [c.id]: source })} />{source === 'local' ? '保留此裝置' : '保留雲端'}</span>
            <div className="max-h-52 overflow-y-auto"><RecordSummary row={c[source]} /></div>
          </label>)}</div>
        </fieldset>)}
        <Button variant="primary" block disabled={busy || status.phase === 'syncing' || status.conflicts.some((c) => !choices[c.id])} onClick={() => void run(async () => { await resolveSyncConflicts(choices); })}>確認選擇並同步</Button></div>
      </Section> : null}
      <Section title="其他裝置加入"><div className="card flex flex-col gap-3 p-4">
        <Button block disabled={busy} onClick={() => void run(async () => { const value = await makePairingCode(); setNow(Date.now()); setPair(value); })}>產生限時配對 QR 碼</Button>
        <Button block onClick={() => { setReveal(false); setKeyOpen(true); }}>查看與保存恢復金鑰</Button>
        <p className="text-sm text-chalk-3">配對碼 5 分鐘內有效，只能使用一次。恢復金鑰遺失且沒有已配對裝置時，無法解密雲端紀錄。</p>
      </div></Section>
      <Section title="近期版本"><div className="card flex flex-col gap-3 p-4">
        <p className="text-sm text-chalk-3">保留最近 10 次成功寫入的同步版本，方便還原誤改；不是長期完整備份，進度照不包含在內。</p>
        <Button disabled={busy} block onClick={() => void run(async () => setVersions(await listSyncVersions()))}>查看近期同步版本</Button>
        {versions?.map((v) => <div key={v.revision} className="flex items-center justify-between gap-3 border-t border-seam py-2"><span className="num text-sm">版本 {v.revision}<span className="block text-chalk-3">{new Date(v.createdAt).toLocaleString('zh-TW')}</span></span><Button disabled={busy} onClick={() => setRestore(v.revision)}>還原</Button></div>)}
      </div></Section>
      <Button variant="ghost" block onClick={() => setStopOpen(true)}>停止此裝置同步</Button>
    </>}
    <Link to={settings?.onboarded ? '/train' : '/onboarding'} className="press flex min-h-11 items-center justify-center text-sm text-chalk-3">{settings?.onboarded ? '回到訓練' : '回到首次設定'}</Link>
    <Sheet open={joinOpen} title="加入同步空間" onClose={() => setJoinOpen(false)} footer={<Button variant="primary" block disabled={busy || !input.trim()} onClick={() => void inspect()}>{busy ? '讀取中…' : '讀取並預覽紀錄'}</Button>}>
      {error && <p role="alert" className="mb-3 text-warn">{error}</p>}
      <Field label="恢復金鑰或限時配對碼"><input type="password" className="field font-mono" aria-label="恢復金鑰或限時配對碼" autoComplete="off" spellCheck={false} value={input} onChange={(e) => setInput(e.target.value)} placeholder="FIT1.… 或 PAIR1.…" /></Field>
      <p className="mt-3 text-sm text-chalk-3">金鑰只在此裝置用於解密，不會傳給同步服務。讀取後會先預覽，不會立即覆蓋本機資料。</p>
    </Sheet>
    <Sheet open={preview != null} title="確認加入同步空間" onClose={() => setPreview(null)} footer={<Button variant="primary" block disabled={busy} onClick={() => void run(async () => { await joinSyncSpace(preview!.credential); setPreview(null); })}>{busy ? '加入中…' : '保留兩邊紀錄並啟用同步'}</Button>}>
      {preview && <><p className="mb-3 text-sm text-chalk-2">雲端版本 {preview.revision}。不同筆紀錄會合併，同一筆有差異會請你選擇；本機已有資料時會先自動下載一份備份。</p>
        <div className="grid grid-cols-2 gap-3">{BACKUP_TABLES.filter((t) => preview.data.tables[t].length && !['settings', 'foodUsage', 'photos'].includes(t)).map((t) => <div className="rounded-md bg-well p-3" key={t}><p className="label">{BACKUP_SPECS[t].label}</p><p className="num font-semibold">{preview.data.tables[t].length} 筆</p></div>)}</div></>}
    </Sheet>
    <Sheet open={keyOpen && !!credential} title="保存恢復金鑰" onClose={() => { setKeyOpen(false); setReveal(false); }} footer={<Button block variant="primary" disabled={!keySaved} onClick={() => { setKeyOpen(false); setReveal(false); }}>我已保存，完成</Button>}>
      <p className="mb-4 text-sm text-chalk-2">這組金鑰可解密並讀寫全部同步紀錄。請保存到自己的密碼管理工具，不要放進給教練的摘要或公開傳送。</p>
      <Field label="恢復金鑰"><input aria-label="我的恢復金鑰" className="field font-mono" type={reveal ? 'text' : 'password'} readOnly value={credential?.recoveryKey ?? ''} onFocus={(e) => e.currentTarget.select()} /></Field>
      <div className="mt-3 flex gap-2"><Button block onClick={() => setReveal(!reveal)}>{reveal ? '隱藏金鑰' : '顯示金鑰'}</Button><Button block onClick={() => void copy(credential?.recoveryKey ?? '')}>複製金鑰</Button></div>
      <label className="mt-3 flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={keySaved} onChange={(e) => setKeySaved(e.target.checked)} />我已另外妥善保存恢復金鑰</label>
    </Sheet>
    <Sheet open={!!pair} title="另一裝置掃描加入" onClose={() => setPair(null)}>
      {pair && <div className="flex flex-col items-center gap-4">{now < pair.expiresAt ? <img src={qr} alt="限時配對 QR 碼" className="w-64 max-w-full rounded-md" /> : <p className="text-warn">配對碼已到期，請關閉後重新產生。</p>}
        <p className="num text-sm text-chalk-2">剩餘 {Math.max(0, Math.ceil((pair.expiresAt - now) / 1000))} 秒 · 限用一次</p>
        <input aria-label="限時配對碼" className="field font-mono text-sm" readOnly value={pair.code} onFocus={(e) => e.currentTarget.select()} />
        <Button block disabled={now >= pair.expiresAt} onClick={() => void copy(pair.code)}>複製配對碼</Button>
        <p className="text-sm text-chalk-3">請只讓自己的另一台裝置掃描。配對成功後即失效。</p></div>}
    </Sheet>
    {scan && <PairingScanner onClose={() => setScan(false)} onResult={(code) => { setScan(false); void inspect(code); }} />}
    <Sheet open={restore != null} title="還原近期版本？" onClose={() => setRestore(null)} footer={<Button variant="danger" block disabled={busy} onClick={() => void run(async () => { await restoreSyncVersion(restore!); setRestore(null); setVersions(await listSyncVersions()); })}>還原此版本並同步到其他裝置</Button>}>
      <p className="text-chalk-2">將用版本 {restore} 取代目前已完成的紀錄，進行中的訓練與本機照片會保留。會先自動下載本機備份，再建立新的雲端版本。</p>
    </Sheet>
    <Sheet open={stopOpen} title="停止此裝置同步？" onClose={() => setStopOpen(false)} footer={<Button variant="danger" block disabled={busy} onClick={() => void run(async () => { await disconnectSync(); setStopOpen(false); setPair(null); })}>停止同步並移除此裝置金鑰</Button>}>
      <p className="text-chalk-2">保留本機健身紀錄與雲端版本，只移除此裝置的同步授權。之後可用保存的恢復金鑰重新加入。</p>
    </Sheet>
  </div>;
}
