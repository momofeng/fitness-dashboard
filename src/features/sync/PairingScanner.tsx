import { useEffect, useRef, useState } from 'react';
import { createBarcodeDetector, detectOnce, openRearCamera, stopStream } from '../../lib/barcode';
import { Sheet } from '../../ui/Sheet';
export function PairingScanner({ onResult, onClose }: { onResult: (code: string) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false; let stream: MediaStream | null = null; let timer: ReturnType<typeof setTimeout> | undefined;
    void (async () => {
      const detector = await createBarcodeDetector(['qr_code']);
      if (!detector) { setError('此瀏覽器無法掃 QR 碼，請關閉後貼上配對碼。'); return; }
      try {
        stream = await openRearCamera(); if (cancelled) { stopStream(stream); return; }
        const element = video.current; if (!element) return;
        element.srcObject = stream; await element.play();
        const scan = async () => {
          if (cancelled) return;
          const code = element.readyState >= 2 ? await detectOnce(detector, element) : null;
          if (code?.startsWith('PAIR1.')) { if (!cancelled) onResult(code); return; }
          timer = setTimeout(() => void scan(), 250);
        }; void scan();
      } catch { if (!cancelled) setError('無法開啟相機；請允許權限，或關閉後貼上配對碼。'); }
    })();
    return () => { cancelled = true; if (timer) clearTimeout(timer); stopStream(stream); if (video.current) video.current.srcObject = null; };
  }, []);
  return <Sheet open title="掃描限時配對碼" onClose={onClose}>
    <p className="mb-3 text-sm text-chalk-2">對準舊裝置顯示的 QR 碼。掃描只在本機進行。</p>
    {error ? <p role="alert" className="text-warn">{error}</p> : <video ref={video} muted playsInline className="aspect-square w-full rounded-lg bg-well object-cover" aria-label="配對掃描相機" />}
  </Sheet>;
}
