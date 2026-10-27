// 拍照辨識：縮圖（去掉 EXIF／GPS，不存進資料庫）→ AI 辨識食物名稱與估計重量 → 交給確認清單。
// 這個檔案與 gemini.ts 都是動態載入，沒用到 AI 的人不會下載。

import { useEffect, useRef, useState } from 'react';
import { aiErrorMessage, getAiProvider, type FoodGuess } from '../../ai/provider';
import { AI } from '../../db/limits';
import { useSettings } from '../../db/repo/settings';
import type { Meal } from '../../db/schemas';
import { resizeToJpeg } from '../../lib/image';
import { Button } from '../../ui/Button';
import { Sheet } from '../../ui/Sheet';
import { AiReview } from './AiReview';

type State = { phase: 'working' } | { phase: 'error'; message: string } | { phase: 'done'; guesses: FoodGuess[] };

export default function PhotoFood({
  file,
  date,
  meal,
  onClose,
  onAdded,
  onRetake,
}: {
  file: File;
  date: string;
  meal: Meal;
  onClose: () => void;
  onAdded: () => void;
  onRetake: () => void;
}) {
  const settings = useSettings();
  const aiRef = useRef(settings?.ai);
  aiRef.current = settings?.ai;
  const loaded = !!settings;
  const [state, setState] = useState<State>({ phase: 'working' });
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  // 預覽圖只跟著檔案：重試不換網址，也就不會在重試的瞬間顯示已經被撤銷的舊網址（破圖）
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setPhotoUrl(url);
    return () => {
      URL.revokeObjectURL(url);
      setPhotoUrl(null);
    };
  }, [file]);

  useEffect(() => {
    if (!loaded || !aiRef.current) return;
    const ctrl = new AbortController();
    setState({ phase: 'working' });
    void (async () => {
      try {
        const { blob } = await resizeToJpeg(file, AI.imageLongSide, AI.imageQuality);
        if (ctrl.signal.aborted) return;
        const provider = await getAiProvider(aiRef.current!);
        const guesses = await provider.recognizePhoto(blob, ctrl.signal);
        if (!ctrl.signal.aborted) setState({ phase: 'done', guesses });
      } catch (e) {
        if (!ctrl.signal.aborted) setState({ phase: 'error', message: aiErrorMessage(e) });
      }
    })();
    return () => ctrl.abort();
  }, [file, attempt, loaded]);

  if (state.phase === 'done') {
    return (
      <AiReview
        key={attempt}
        guesses={state.guesses}
        photoUrl={photoUrl}
        date={date}
        meal={meal}
        title="辨識結果"
        onClose={onClose}
        onAdded={onAdded}
        onRetry={() => setAttempt((a) => a + 1)}
      />
    );
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={state.phase === 'working' ? '辨識中…' : '辨識失敗'}
      footer={
        state.phase === 'working' ? (
          <Button block onClick={onClose}>
            取消
          </Button>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <Button variant="primary" onClick={() => setAttempt((a) => a + 1)}>
              重試
            </Button>
            <Button onClick={onRetake}>重拍</Button>
          </div>
        )
      }
    >
      <div className="flex flex-col items-center gap-4 py-2 text-center">
        {photoUrl && <img src={photoUrl} alt="要辨識的照片" className="max-h-60 rounded-md border border-seam object-contain" />}
        {state.phase === 'working' ? (
          <p role="status" className="animate-pulse text-chalk-2">
            AI 正在看這張照片…
          </p>
        ) : (
          <p role="alert" className="text-danger">
            {state.message}
          </p>
        )}
        {state.phase === 'error' && <p className="text-sm text-chalk-3">也可以關閉這個視窗，改用搜尋食物。</p>}
      </div>
    </Sheet>
  );
}
