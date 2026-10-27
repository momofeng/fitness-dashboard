// 一句話輸入：「午餐雞胸肉 200 克加半碗飯」→ AI 拆成食物名稱與重量 → 交給確認清單。

import { useEffect, useRef, useState } from 'react';
import { aiErrorMessage, getAiProvider, type FoodGuess } from '../../ai/provider';
import { AI } from '../../db/limits';
import { useSettings } from '../../db/repo/settings';
import type { Meal } from '../../db/schemas';
import { Button } from '../../ui/Button';
import { Sheet } from '../../ui/Sheet';
import { AiReview } from './AiReview';

export default function TextFood({ date, meal, onClose, onAdded }: { date: string; meal: Meal; onClose: () => void; onAdded: () => void }) {
  const settings = useSettings();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guesses, setGuesses] = useState<FoodGuess[] | null>(null);
  const ctrlRef = useRef<AbortController | null>(null);
  useEffect(() => () => ctrlRef.current?.abort(), []);

  const run = async () => {
    if (!settings || !text.trim()) return;
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;
    setBusy(true);
    setError(null);
    try {
      const provider = await getAiProvider(settings.ai);
      const r = await provider.parseText(text, ctrl.signal);
      if (ctrl.signal.aborted) return;
      setGuesses(r);
    } catch (e) {
      if (!ctrl.signal.aborted) setError(aiErrorMessage(e));
    } finally {
      if (!ctrl.signal.aborted) setBusy(false);
    }
  };

  if (guesses) {
    return (
      <AiReview
        guesses={guesses}
        date={date}
        meal={meal}
        title="辨識結果"
        onClose={onClose}
        onAdded={onAdded}
        onRetry={() => {
          setGuesses(null);
          setBusy(false);
        }}
      />
    );
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title="一句話輸入"
      footer={
        busy ? (
          <Button
            block
            onClick={() => {
              ctrlRef.current?.abort();
              setBusy(false);
            }}
          >
            取消
          </Button>
        ) : (
          <Button variant="primary" size="lg" block disabled={!text.trim()} onClick={() => void run()}>
            辨識
          </Button>
        )
      }
    >
      <div className="flex flex-col gap-3">
        <label htmlFor="ai-text" className="text-sm font-medium text-chalk-2">
          這一餐吃了什麼？
        </label>
        <textarea
          id="ai-text"
          className="field min-h-28 py-2"
          maxLength={AI.textMax}
          placeholder="例如：雞胸肉 200 克、半碗白飯、一顆水煮蛋、無糖豆漿一杯"
          value={text}
          disabled={busy}
          onChange={(e) => setText(e.target.value)}
        />
        <p className="text-cap text-chalk-3">
          {text.length}/{AI.textMax}。寫了重量就照寫，只寫份量（碗、顆、杯）會換算成公克。下一步可以逐項確認、修改。
        </p>
        {busy && (
          <p role="status" className="animate-pulse text-chalk-2">
            AI 正在整理…
          </p>
        )}
        {error && (
          <p role="alert" className="text-danger">
            {error}
          </p>
        )}
      </div>
    </Sheet>
  );
}
