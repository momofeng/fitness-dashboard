import { useEffect, useState } from 'react';
import { aiErrorMessage, getAiProvider } from '../../ai/provider';
import { clearAiKey, maskKey, readAiKey, saveAiKey } from '../../ai/key';
import { AI } from '../../db/limits';
import { updateSettings } from '../../db/repo/settings';
import type { Settings } from '../../db/schemas';
import { Button } from '../../ui/Button';
import { Field, Toggle } from '../../ui/Fields';
import { toast } from '../../ui/toast';

/** 設定頁的「AI 辨識」：啟用開關（同時代表你了解照片會送到 Google）、金鑰、模型、測試連線 */
export function AiCard({ s }: { s: Settings }) {
  const [key, setKey] = useState<string | null>(() => readAiKey());
  const [draft, setDraft] = useState('');
  const [model, setModel] = useState(s.ai.model ?? '');
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => setModel(s.ai.model ?? ''), [s.ai.model]);

  const test = async () => {
    setTesting(true);
    setResult(null);
    try {
      const p = await getAiProvider(s.ai);
      const guesses = await p.parseText('白飯 100 克');
      setResult({
        ok: true,
        text: guesses.length ? `連線成功：${guesses.map((g) => `${g.name} ${g.grams} g`).join('、')}` : '連線成功，但這次沒有辨識出食物。',
      });
    } catch (e) {
      const detail = (e as { detail?: string }).detail;
      setResult({ ok: false, text: `${aiErrorMessage(e)}${detail ? `（${detail.slice(0, 160)}）` : ''}` });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="card flex flex-col gap-4 p-4">
      <p className="text-sm text-chalk-2">
        拍照或輸入一句話，AI 只負責認出食物名稱、估計重量；熱量與營養一律由內建的衛福部食物資料庫依重量計算。
      </p>
      <p className="rounded-md bg-warn-soft px-3 py-2 text-sm text-warn">
        啟用後，辨識用的照片（縮小、去掉拍攝位置，不會存下來）或文字會送到 Google Gemini。Google 免費方案的內容可能被用來改進產品，並由人工審閱；想避免請改用已啟用計費的專案。進度照永遠不會上傳。
      </p>
      <Toggle
        label="啟用 AI 辨識"
        hint="開啟代表你了解上面的說明"
        checked={s.ai.enabled}
        onChange={(v) => void updateSettings({ ai: { enabled: v, provider: 'gemini' } })}
      />

      {key ? (
        <div className="flex items-center justify-between gap-3 rounded-md bg-well px-3 py-2.5">
          <div className="min-w-0">
            <p className="text-sm font-medium text-chalk-2">Gemini 金鑰</p>
            <p className="num text-sm text-chalk-3">已儲存 {maskKey(key)}</p>
          </div>
          <Button
            size="sm"
            onClick={() => {
              clearAiKey();
              setKey(null);
              setResult(null);
              toast('已移除金鑰');
            }}
          >
            移除金鑰
          </Button>
        </div>
      ) : (
        <Field
          label="Gemini API 金鑰"
          hint={
            <>
              到{' '}
              <a className="underline" href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">
                Google AI Studio
              </a>{' '}
              建立一把專用金鑰貼在這裡。
            </>
          }
        >
          <div className="flex items-center gap-2">
            <input
              className="field flex-1"
              type="password"
              name="ai-key"
              autoComplete="off"
              spellCheck={false}
              maxLength={AI.keyMax}
              placeholder="貼上金鑰"
              aria-label="Gemini API 金鑰"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
            <Button
              disabled={!draft.trim()}
              onClick={() => {
                if (saveAiKey(draft)) {
                  setKey(readAiKey());
                  setDraft('');
                  toast('已儲存金鑰');
                } else toast('金鑰格式不正確，或這個瀏覽器不允許儲存');
              }}
            >
              儲存
            </Button>
          </div>
        </Field>
      )}
      <p className="text-cap text-chalk-3">
        金鑰只存在這支手機，不會進備份檔；能打開這支手機瀏覽器的人都看得到它。請用專用金鑰，並在 Google 端設定用量上限。
      </p>

      <Field label="模型" hint="Google 會淘汰舊模型；辨識失敗並顯示找不到模型時，到這裡改成新的。留空使用預設。">
        <input
          className="field"
          name="ai-model"
          autoComplete="off"
          spellCheck={false}
          maxLength={AI.modelMax}
          placeholder={AI.defaultModel}
          aria-label="模型"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          onBlur={() => {
            const next = model.trim() || null;
            if (next !== (s.ai.model ?? null)) void updateSettings({ ai: { model: next } });
          }}
        />
      </Field>

      <div className="flex flex-col gap-2">
        <Button disabled={!s.ai.enabled || !key || testing} onClick={() => void test()}>
          {testing ? '測試中…' : '測試連線'}
        </Button>
        {!s.ai.enabled || !key ? <p className="text-cap text-chalk-3">需要先啟用並儲存金鑰。測試會送出一則很短的文字請求。</p> : null}
        {result && (
          <p role="status" className={`text-sm ${result.ok ? 'text-go' : 'text-danger'}`}>
            {result.text}
          </p>
        )}
      </div>
    </div>
  );
}
