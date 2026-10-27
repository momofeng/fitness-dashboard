// AI 辨識：回應解析（不可信輸入）、Gemini 請求組裝與錯誤對應、金鑰儲存。全部 mock，不打真實 API。

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildBody, createGeminiProvider, RESPONSE_SCHEMA, toBase64 } from '../../src/ai/gemini';
import { AI_KEY_STORAGE, clearAiKey, maskKey, readAiKey, saveAiKey } from '../../src/ai/key';
import { parseGuesses } from '../../src/ai/parse';
import { AiError } from '../../src/ai/provider';
import { AI } from '../../src/db/limits';

const wrap = (foods: unknown) => JSON.stringify({ foods });

describe('parseGuesses', () => {
  it('取出名稱、同義名、重量、信心', () => {
    const r = parseGuesses(wrap([{ name: '白飯', altNames: ['米飯', '飯'], grams: 180, confidence: 0.9 }]));
    expect(r).toEqual([{ name: '白飯', altNames: ['米飯', '飯'], grams: 180, confidence: 0.9, cooked: false }]);
  });

  it('cooked 只認布林 true（字串、數字都當沒煮）', () => {
    const r = parseGuesses(wrap([{ name: 'a', grams: 1, cooked: true }, { name: 'b', grams: 1, cooked: 'true' }, { name: 'c', grams: 1, cooked: 1 }, { name: 'd', grams: 1 }]));
    expect(r.map((x) => x.cooked)).toEqual([true, false, false, false]);
  });

  it('接受 ```json 包住的回應與純陣列', () => {
    expect(parseGuesses('```json\n' + wrap([{ name: '水煮蛋', grams: 50 }]) + '\n```')).toHaveLength(1);
    expect(parseGuesses(JSON.stringify([{ name: '水煮蛋', grams: 50 }]))).toHaveLength(1);
  });

  it('模型多給的營養欄位一律不讀（營養只由資料庫算）', () => {
    const r = parseGuesses(wrap([{ name: '雞胸肉', grams: 150, kcal: 999, protein: 99, nutrients: { kcal: 1 }, per: { kcal: 5 } }]));
    expect(Object.keys(r[0]!).sort()).toEqual(['altNames', 'confidence', 'cooked', 'grams', 'name']);
  });

  it('重量夾進範圍並取整；缺重量或不是數字時給 100', () => {
    const [lo, hi] = AI.gramsRange;
    const r = parseGuesses(wrap([{ name: 'a', grams: -5 }, { name: 'b', grams: 99999 }, { name: 'c', grams: 123.6 }, { name: 'd' }, { name: 'e', grams: '200' }]));
    expect(r.map((x) => x.grams)).toEqual([lo, hi, 124, 100, 100]);
  });

  it('信心夾在 0–1', () => {
    const r = parseGuesses(wrap([{ name: 'a', grams: 1, confidence: 5 }, { name: 'b', grams: 1, confidence: -1 }, { name: 'c', grams: 1 }]));
    expect(r.map((x) => x.confidence)).toEqual([1, 0, 0.5]);
  });

  it('超過上限截斷、重複名稱去重、空名稱略過、同義名限量且不含本名', () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ name: `食物${i}`, grams: 10 }));
    expect(parseGuesses(wrap(many))).toHaveLength(AI.maxItems);
    const r = parseGuesses(wrap([{ name: '白飯', grams: 1 }, { name: '白飯', grams: 2 }, { name: '  ', grams: 3 }, { name: 'x', grams: 1, altNames: ['x', 'a', 'b', 'c', 'd'] }]));
    expect(r.map((x) => x.name)).toEqual(['白飯', 'x']);
    expect(r[1]!.altNames).toEqual(['a', 'b', 'c']);
  });

  it('名稱限長、全形轉半形、壓縮空白', () => {
    const r = parseGuesses(wrap([{ name: '　ＡＢ　  Ｃ' + 'x'.repeat(200), grams: 1 }]));
    expect(r[0]!.name.startsWith('AB C')).toBe(true);
    expect(r[0]!.name.length).toBeLessThanOrEqual(AI.nameMax);
  });

  it('壞 JSON 或缺 foods 丟 format 錯誤；空陣列是合法結果', () => {
    for (const bad of ['不是 json', '{}', '{"foods":"x"}', 'null']) {
      expect(() => parseGuesses(bad)).toThrowError(expect.objectContaining({ code: 'format' }));
    }
    expect(parseGuesses('{"foods":[]}')).toEqual([]);
  });
});

describe('Gemini 請求', () => {
  const ok = (foods: unknown) => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: wrap(foods) }] }, finishReason: 'STOP' }] }), { status: 200 });

  it('回應 schema 只有名稱與重量，沒有任何營養欄位', () => {
    const s = JSON.stringify(RESPONSE_SCHEMA).toLowerCase();
    for (const w of ['kcal', 'calor', 'protein', 'carb', 'fat', 'nutri']) expect(s).not.toContain(w);
    expect(JSON.stringify(buildBody([{ text: 'x' }]))).toContain('"responseMimeType":"application/json"');
  });

  it('金鑰放 header 不放網址；模型 ID 進網址；照片以 inline_data 送出 base64', async () => {
    const fetchImpl = vi.fn(async () => ok([{ name: '白飯', grams: 150 }]));
    const p = createGeminiProvider({ key: 'KEY-123', model: 'gemini-test/1', fetchImpl: fetchImpl as unknown as typeof fetch });
    const img = new Blob([new Uint8Array([1, 2, 3, 250, 251])], { type: 'image/jpeg' });
    const r = await p.recognizePhoto(img);
    expect(r[0]).toMatchObject({ name: '白飯', grams: 150 });
    const [url, init] = fetchImpl.mock.calls[0]! as unknown as [string, RequestInit];
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-test%2F1:generateContent');
    expect(url).not.toContain('KEY-123');
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe('KEY-123');
    const body = JSON.parse(init.body as string);
    expect(body.contents[0].parts[1].inline_data).toEqual({ mime_type: 'image/jpeg', data: await toBase64(img) });
    expect(body.contents[0].parts[1].inline_data.data).toBe(btoa(String.fromCharCode(1, 2, 3, 250, 251)));
  });

  it('文字輸入：空字串不呼叫 API；超長截斷；內容放進 prompt', async () => {
    const fetchImpl = vi.fn(async (_url: string, _init?: RequestInit) => ok([{ name: '雞胸肉', grams: 200 }]));
    const p = createGeminiProvider({ key: 'k', model: 'm', fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(await p.parseText('   ')).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
    await p.parseText('雞胸肉 200 克' + '字'.repeat(1000));
    const body = JSON.parse((fetchImpl.mock.calls[0]![1] as RequestInit).body as string);
    const prompt: string = body.contents[0].parts[0].text;
    expect(prompt).toContain('雞胸肉 200 克');
    expect(prompt.split('使用者描述：\n')[1]!.length).toBeLessThanOrEqual(AI.textMax);
  });

  it.each([
    [403, '{"error":{"message":"denied"}}', 'auth'],
    [401, '{"error":{"message":"x"}}', 'auth'],
    [400, '{"error":{"message":"API key not valid. Please pass a valid API key."}}', 'auth'],
    [429, '{"error":{"message":"quota"}}', 'quota'],
    [503, '{"error":{"message":"busy"}}', 'network'],
    [400, '{"error":{"message":"models/foo is not found"}}', 'format'],
  ])('HTTP %i → %s', async (status, text, code) => {
    const fetchImpl = vi.fn(async () => new Response(text, { status }));
    const p = createGeminiProvider({ key: 'k', model: 'm', fetchImpl: fetchImpl as unknown as typeof fetch });
    await expect(p.parseText('白飯')).rejects.toMatchObject({ code });
  });

  it('把供應商的錯誤訊息放進 detail，且不含金鑰', async () => {
    const fetchImpl = vi.fn(async () => new Response('{"error":{"message":"models/foo is not found"}}', { status: 404 }));
    const p = createGeminiProvider({ key: 'SECRET-KEY', model: 'foo', fetchImpl: fetchImpl as unknown as typeof fetch });
    const e = (await p.parseText('白飯').catch((x) => x)) as AiError;
    expect(e.detail).toContain('not found');
    expect(`${e.message}${e.detail}`).not.toContain('SECRET-KEY');
  });

  it('被擋下、沒內容、網路失敗各有對應代碼', async () => {
    const mk = (res: () => Promise<Response>) => createGeminiProvider({ key: 'k', model: 'm', fetchImpl: vi.fn(res) as unknown as typeof fetch });
    await expect(mk(async () => new Response(JSON.stringify({ promptFeedback: { blockReason: 'SAFETY' } }))).parseText('a')).rejects.toMatchObject({ code: 'blocked' });
    await expect(mk(async () => new Response(JSON.stringify({ candidates: [{ finishReason: 'SAFETY' }] }))).parseText('a')).rejects.toMatchObject({ code: 'blocked' });
    await expect(mk(async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'hi' }] } }] }))).parseText('a')).rejects.toMatchObject({ code: 'format' });
    await expect(mk(() => Promise.reject(new TypeError('Failed to fetch'))).parseText('a')).rejects.toMatchObject({ code: 'network' });
  });

  describe('取消與逾時', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());
    const hang = (_url: unknown, init?: RequestInit) =>
      new Promise<Response>((_res, rej) => init?.signal?.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError'))));

    it('超過時間上限 → timeout', async () => {
      const p = createGeminiProvider({ key: 'k', model: 'm', fetchImpl: hang as unknown as typeof fetch });
      const pending = p.parseText('白飯');
      const assertion = expect(pending).rejects.toMatchObject({ code: 'timeout' });
      await vi.advanceTimersByTimeAsync(AI.timeoutMs + 1);
      await assertion;
    });

    it('使用者取消 → aborted，不是 timeout', async () => {
      const p = createGeminiProvider({ key: 'k', model: 'm', fetchImpl: hang as unknown as typeof fetch });
      const ctrl = new AbortController();
      const pending = p.parseText('白飯', ctrl.signal);
      const assertion = expect(pending).rejects.toMatchObject({ code: 'aborted' });
      ctrl.abort();
      await assertion;
    });
  });
});

describe('金鑰儲存', () => {
  const store = new Map<string, string>();
  beforeEach(() => {
    store.clear();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('存、讀、清；前後空白會去掉', () => {
    expect(readAiKey()).toBeNull();
    expect(saveAiKey('  abc123  ')).toBe(true);
    expect(store.get(AI_KEY_STORAGE)).toBe('abc123');
    expect(readAiKey()).toBe('abc123');
    clearAiKey();
    expect(readAiKey()).toBeNull();
  });

  it('空白、含空白、過長的金鑰不存', () => {
    expect(saveAiKey('   ')).toBe(false);
    expect(saveAiKey('a b')).toBe(false);
    expect(saveAiKey('x'.repeat(AI.keyMax + 1))).toBe(false);
    expect(store.size).toBe(0);
  });

  it('localStorage 被擋（丟例外）時不會崩', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    });
    expect(readAiKey()).toBeNull();
    expect(saveAiKey('abc')).toBe(false);
    expect(() => clearAiKey()).not.toThrow();
  });

  it('遮罩只露出末 4 碼', () => {
    expect(maskKey('AIzaSyABCDEFGH1234')).toBe('••••1234');
    expect(maskKey('ab')).toBe('••••');
  });
});
