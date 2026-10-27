// 條碼辨識：Android Chrome 內建的 BarcodeDetector（Shape Detection API）。不支援的瀏覽器安靜退場，改用手動輸入。

interface DetectedBarcode {
  rawValue: string;
  format: string;
}
interface BarcodeDetectorLike {
  detect(source: ImageBitmapSource): Promise<DetectedBarcode[]>;
}
interface BarcodeDetectorCtor {
  new (opts?: { formats?: string[] }): BarcodeDetectorLike;
  getSupportedFormats?: () => Promise<string[]>;
}

/** 食品包裝常見的格式 */
const RETAIL = ['ean_13', 'ean_8', 'upc_a', 'upc_e'];

function ctor(): BarcodeDetectorCtor | null {
  const c = (globalThis as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
  return typeof c === 'function' ? c : null;
}

export function barcodeDetectorAvailable(): boolean {
  return ctor() != null;
}

/** 建立偵測器；不支援或沒有商品條碼格式時回傳 null */
export async function createBarcodeDetector(requested: string[] = RETAIL): Promise<BarcodeDetectorLike | null> {
  const C = ctor();
  if (!C) return null;
  try {
    const supported = (await C.getSupportedFormats?.()) ?? requested;
    const formats = requested.filter((f) => supported.includes(f));
    if (formats.length === 0) return null;
    return new C({ formats });
  } catch {
    return null;
  }
}

export async function detectOnce(detector: BarcodeDetectorLike, source: ImageBitmapSource): Promise<string | null> {
  try {
    const found = await detector.detect(source);
    return found.find((b) => b.rawValue)?.rawValue ?? null;
  } catch {
    return null;
  }
}

/** 開後鏡頭；失敗（拒絕權限、沒有相機）時丟出錯誤，由畫面顯示原因 */
export async function openRearCamera(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('這個瀏覽器不能使用相機');
  return navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
}

export function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((t) => t.stop());
}
