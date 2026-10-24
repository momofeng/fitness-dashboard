// 條碼掃描：相機即時辨識（BarcodeDetector）＋拍照辨識＋手動輸入。關閉時一定停止相機。

import { useEffect, useRef, useState } from 'react';
import { isValidGtin, normalizeBarcode } from '../../core/barcode';
import { barcodeDetectorAvailable, createBarcodeDetector, detectOnce, openRearCamera, stopStream } from '../../lib/barcode';
import { Button } from '../../ui/Button';
import { Field } from '../../ui/Fields';
import { Sheet } from '../../ui/Sheet';

type Phase = 'starting' | 'scanning' | 'no-camera' | 'unsupported';

export function BarcodeScanner({ open, onClose, onResult }: { open: boolean; onClose: () => void; onResult: (code: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>('starting');
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState('');
  const doneRef = useRef(false);

  const finish = (raw: string) => {
    if (doneRef.current) return;
    const code = normalizeBarcode(raw);
    if (!code) return;
    doneRef.current = true;
    onResult(code);
  };

  useEffect(() => {
    if (!open) return;
    doneRef.current = false;
    setManual('');
    setError(null);
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;
    void (async () => {
      if (!barcodeDetectorAvailable()) return setPhase('unsupported');
      const detector = await createBarcodeDetector();
      if (!detector) return setPhase('unsupported');
      setPhase('starting');
      try {
        stream = await openRearCamera();
      } catch (e) {
        if (!cancelled) {
          setPhase('no-camera');
          setError(e instanceof DOMException && e.name === 'NotAllowedError' ? '沒有相機權限，可以改用拍照或手動輸入。' : '無法開啟相機，可以改用拍照或手動輸入。');
        }
        return;
      }
      if (cancelled) return stopStream(stream);
      const v = videoRef.current;
      if (!v) return stopStream(stream);
      v.srcObject = stream;
      await v.play().catch(() => undefined);
      setPhase('scanning');
      const tick = async () => {
        if (cancelled || doneRef.current) return;
        if (v.readyState >= 2) {
          const code = await detectOnce(detector, v);
          if (code && !cancelled) return finish(code);
        }
        timer = setTimeout(() => void tick(), 250);
      };
      void tick();
    })();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      stopStream(stream);
      if (videoRef.current) videoRef.current.srcObject = null;
    };
    // finish 只用到 ref 與 onResult，開關時重新開始即可
  }, [open]);

  async function fromPhoto(file: File | undefined) {
    if (!file) return;
    const detector = await createBarcodeDetector();
    if (!detector) return setError('這個瀏覽器不支援條碼辨識，請手動輸入號碼。');
    try {
      const bmp = await createImageBitmap(file);
      const code = await detectOnce(detector, bmp);
      bmp.close();
      if (code) finish(code);
      else setError('照片裡找不到條碼，請靠近一點、對準條碼再拍一次。');
    } catch {
      setError('無法讀取這張照片。');
    }
  }

  const manualCode = normalizeBarcode(manual);
  const manualOk = /^\d{8,14}$/.test(manualCode);

  return (
    <Sheet open={open} onClose={onClose} title="掃描條碼">
      <div className="flex flex-col gap-4">
        {phase !== 'unsupported' && (
          <div className="relative overflow-hidden rounded-lg bg-well" style={{ aspectRatio: '4 / 3' }}>
            <video ref={videoRef} className="h-full w-full object-cover" muted playsInline aria-label="相機畫面" />
            {phase === 'scanning' && <div className="pointer-events-none absolute inset-x-8 top-1/2 h-0.5 -translate-y-1/2 bg-danger/80" aria-hidden="true" />}
            <p className="absolute inset-x-0 bottom-0 bg-floor/70 px-3 py-2 text-center text-sm text-chalk-2" role="status">
              {phase === 'starting' ? '開啟相機中…' : phase === 'scanning' ? '把條碼放進畫面中間' : '相機無法使用'}
            </p>
          </div>
        )}
        {phase === 'unsupported' && <p className="rounded-md bg-well px-3 py-2 text-sm text-chalk-2">這個瀏覽器不支援條碼辨識（Android 的 Chrome 才有），請手動輸入條碼下方的數字。</p>}
        {error && <p className="text-sm text-warn">{error}</p>}
        {phase !== 'unsupported' && (
          <>
            <Button icon="upload" block onClick={() => fileRef.current?.click()}>
              拍照辨識
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              aria-label="條碼照片"
              onChange={(e) => {
                void fromPhoto(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </>
        )}
        <Field label="手動輸入條碼" hint={manualOk && !isValidGtin(manualCode) ? '檢查碼對不上，請再核對一次數字（仍可使用）' : '條碼下方的 8–14 位數字'}>
          <div className="flex gap-2">
            <input
              className="field num flex-1"
              inputMode="numeric"
              autoComplete="off"
              maxLength={20}
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              aria-label="條碼號碼"
              placeholder="例如 4710088012340"
            />
            <Button variant="primary" disabled={!manualOk} onClick={() => finish(manualCode)}>
              確定
            </Button>
          </div>
        </Field>
      </div>
    </Sheet>
  );
}
