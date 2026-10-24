// 衛福部食品營養成分資料庫 → public/data/foods-tfda.json
// 用法：node scripts/tfda/convert.ts [zip 路徑] [--version "2026-10-05 版"]
// 原始 zip 放 data-raw/（不進 git）；檢查不通過就不寫檔並以非 0 結束。

import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { checkFoods, OUTPUT_FIELDS, toOutputRows, toWide, type RawRow } from './checks.ts';

const require = createRequire(import.meta.url);
const { unzipSync, strFromU8 } = require('fflate') as typeof import('fflate');

const args = process.argv.slice(2);
const vi = args.indexOf('--version');
const version = vi >= 0 ? args[vi + 1]! : new Date().toISOString().slice(0, 10);
const zipPath = args.find((a, i) => !a.startsWith('--') && (vi < 0 || i !== vi + 1)) ?? 'data-raw/tfda-20-json.zip';

const files = unzipSync(readFileSync(zipPath));
const entry = Object.entries(files).find(([n]) => n.endsWith('.json'));
if (!entry) throw new Error('zip 內沒有 JSON 檔');
let text = strFromU8(entry[1]);
if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
const raw = JSON.parse(text) as RawRow[];

const wide = toWide(raw);
const report = checkFoods(wide);
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

console.log(`來源：${entry[0]}，${raw.length} 列 → ${report.total} 種食物，可用 ${report.kept}`);
console.log(`排除（缺熱量／蛋白質／脂肪／碳水）：${report.excluded.length}`);
console.log(`覆蓋率：${Object.entries(report.coverage).map(([k, v]) => `${k} ${pct(v)}`).join('、')}`);
console.log(`熱量一致性：檢查 ${report.energy.checked}，離群 ${report.energy.outliers.length}（${pct(report.energy.outlierRate)}）`);
console.log(`成分加總 98–102 g：${report.mass.within}/${report.mass.checked}（${pct(report.mass.rate)}）`);

writeFileSync('data-raw/tfda-report.json', JSON.stringify({ version, ...report }, null, 2));

if (report.errors.length) {
  console.error('檢查失敗：\n- ' + report.errors.join('\n- '));
  process.exit(1);
}

const out = {
  source: '衛生福利部食品藥物管理署',
  dataset: '食品營養成分資料庫（政府資料開放平臺資料集 8543）',
  license: '政府資料開放授權條款－第1版 https://data.gov.tw/license',
  version,
  generatedAt: new Date().toISOString(),
  note: '每 100 g 可食部分；熱量採修正熱量；缺值為 null',
  fields: OUTPUT_FIELDS,
  rows: toOutputRows(wide),
};
const json = JSON.stringify(out);
writeFileSync('public/data/foods-tfda.json', json + '\n');
console.log(`已寫入 public/data/foods-tfda.json（${out.rows.length} 筆，${(json.length / 1024).toFixed(0)} KB）；詳細報告 data-raw/tfda-report.json`);
