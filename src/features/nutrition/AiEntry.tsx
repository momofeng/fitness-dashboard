// 飲食頁的 AI 入口：拍照記錄、從相簿選、一句話輸入。按鈕本身很小、不載入 AI 程式；
// 真正的辨識流程（PhotoFood／TextFood）在使用者按下去才動態載入。
// 相機用 <input type=file capture>：交給系統相機，不需要相機權限，與進度照同一種做法。

import { lazy, Suspense, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { aiReady } from '../../ai/provider';
import { useSettings } from '../../db/repo/settings';
import type { Meal } from '../../db/schemas';
import { Button } from '../../ui/Button';
import { Sheet } from '../../ui/Sheet';
import { toast } from '../../ui/toast';

const PhotoFood = lazy(() => import('./PhotoFood'));
const TextFood = lazy(() => import('./TextFood'));

export function AiFoodEntry({ date, meal, onAdded }: { date: string; meal: Meal; onAdded?: () => void }) {
  const navigate = useNavigate();
  const settings = useSettings();
  const camRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [text, setText] = useState(false);
  const [setup, setSetup] = useState(false);

  /** 還沒啟用／沒有金鑰 → 先引導去設定（不要先打開相機再告訴使用者不能用）；離線 → 直接說明 */
  const guard = (go: () => void) => () => {
    if (!settings || !aiReady(settings.ai)) return setSetup(true);
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return void toast('目前沒有網路，AI 辨識需要連線；可以改用搜尋食物。');
    go();
  };
  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (f) setPhoto(f);
  };
  const done = () => {
    setPhoto(null);
    setText(false);
    onAdded?.();
  };

  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="primary" icon="camera" className="col-span-2" onClick={guard(() => camRef.current?.click())}>
          拍照記錄
        </Button>
        <Button icon="upload" onClick={guard(() => galleryRef.current?.click())}>
          從相簿選
        </Button>
        <Button icon="sparkle" onClick={guard(() => setText(true))}>
          一句話輸入
        </Button>
      </div>
      {/* 隱藏的檔案輸入只負責接住系統相機／相簿的結果，真正的操作是上面的按鈕（所以不讓輔助科技再讀一次） */}
      <input ref={camRef} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-hidden="true" aria-label="拍照記錄" onChange={onFile} />
      <input ref={galleryRef} type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-hidden="true" aria-label="從相簿選照片" onChange={onFile} />

      <Suspense fallback={null}>
        {photo && (
          <PhotoFood
            file={photo}
            date={date}
            meal={meal}
            onClose={() => setPhoto(null)}
            onAdded={done}
            onRetake={() => {
              setPhoto(null);
              camRef.current?.click();
            }}
          />
        )}
        {text && <TextFood date={date} meal={meal} onClose={() => setText(false)} onAdded={done} />}
      </Suspense>

      <Sheet
        open={setup}
        onClose={() => setSetup(false)}
        title="先啟用 AI 辨識"
        footer={
          <Button
            variant="primary"
            size="lg"
            block
            onClick={() => {
              setSetup(false);
              navigate('/settings');
            }}
          >
            前往設定
          </Button>
        }
      >
        <div className="flex flex-col gap-3 text-base text-chalk-2">
          <p>拍照與一句話輸入需要先在「設定 → AI 辨識」啟用，並貼上你自己的 Gemini 金鑰。</p>
          <p className="text-sm text-chalk-3">啟用後，照片或文字會送到 Google 辨識；熱量與營養仍由內建的衛福部食物資料庫計算。不啟用的話，其餘功能完全不受影響。</p>
        </div>
      </Sheet>
    </>
  );
}
