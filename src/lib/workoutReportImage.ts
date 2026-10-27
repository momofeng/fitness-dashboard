import type { ReportSection } from '../core/training/report';
import { download } from './platform';
type Line = { text: string; title: boolean };
export async function reportImages(sections: ReportSection[]): Promise<Blob[]> {
  await document.fonts.ready;
  const canvas = document.createElement('canvas');
  canvas.width = 1080; canvas.height = 2600;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('無法產生圖片');
  const pages: Line[][] = [[]];
  let height = 0;
  const limit = 2200;
  const size = (line: Line) => line.title ? 82 : 58;
  function nextPage() { if (pages.at(-1)!.length) pages.push([]); height = 0; }
  function push(line: Line) { pages.at(-1)!.push(line); height += size(line); }
  function wrap(text: string, title: boolean): Line[] {
    ctx!.font = (title ? '600 48px' : '38px') + ' system-ui, sans-serif';
    const lines: Line[] = [];
    for (const paragraph of text.split('\\n')) {
      let line = '';
      for (const char of Array.from(paragraph)) {
        if (ctx!.measureText(line + char).width > 972) { lines.push({ text: line, title }); line = char; }
        else line += char;
      }
      lines.push({ text: line, title });
    }
    return lines;
  }
  for (const section of sections) {
    const heading = section.title ? wrap(section.title, true) : [];
    const body = section.lines.flatMap((text) => wrap(text, false));
    const block = [...heading, ...body, { text: '', title: false }];
    const blockHeight = block.reduce((n, line) => n + size(line), 0);
    if (blockHeight <= limit && height + blockHeight > limit) nextPage();
    for (const [index, line] of block.entries()) {
      if (height + size(line) > limit) {
        nextPage();
        if (index >= heading.length) {
          for (const title of heading) push({ ...title, text: title.text + '（續）' });
        }
      }
      push(line);
    }
  }
  const blobs: Blob[] = [];
  for (let i = 0; i < pages.length; i++) {
    const lines = pages[i]!;
    canvas.height = Math.min(2600, 220 + lines.reduce((n, v) => n + (v.title ? 82 : 58), 0));
    ctx.fillStyle = '#f8f7f3'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#55534e'; ctx.font = '24px system-ui, sans-serif';
    ctx.fillText((sections[0]?.title ?? '訓練紀錄') + ' · ' + (i + 1) + '／' + pages.length, 54, 65);
    let y = 132;
    for (const line of lines) {
      ctx.fillStyle = line.title ? '#17191b' : '#393b3e';
      ctx.font = (line.title ? '600 48px' : '38px') + ' system-ui, sans-serif';
      ctx.fillText(line.text, 54, y);
      y += line.title ? 82 : 58;
    }
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => b ? resolve(b) : reject(new Error('圖片輸出失敗')), 'image/png'));
    blobs.push(blob);
  }
  return blobs;
}
export async function shareReportImages(blobs: Blob[], date: string): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const files = blobs.map((b, i) => new File([b], date + '-training-' + (i + 1) + '.png', { type: 'image/png' }));
  if (navigator.share && navigator.canShare?.({ files })) {
    try { await navigator.share({ files, title: date + ' 訓練紀錄' }); return 'shared'; }
    catch (e) { if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled'; }
  }
  if (files.length === 1) download(files[0]!, files[0]!.name);
  else {
    const { zipSync } = await import('fflate');
    const entries: Record<string, Uint8Array> = {};
    for (const file of files) entries[file.name] = new Uint8Array(await file.arrayBuffer());
    download(new Blob([zipSync(entries) as Uint8Array<ArrayBuffer>], { type: 'application/zip' }), date + '-training-images.zip');
  }
  return 'downloaded';
}
