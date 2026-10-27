// 產生 v3 合成備份 fixture：由永久保留的 v2 fixture 衍生（schemaVersion 3，多一張 aiMatches 表）。
// 這兩份 fixture 也要永久保留，測試「v3 備份可匯入最新版」。
// 用法：node tests/fixtures/make-backup-v3.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { unzipSync, zipSync } from 'fflate';

const t0 = Date.UTC(2026, 9, 1, 0, 0, 0);
const aiMatches = [
  { norm: '雞胸肉', foodKey: 'tfda:A0100101', count: 3, updatedAt: t0 + 1000 },
  { norm: '白飯', foodKey: 'tfda:A0100202', count: 1, updatedAt: t0 + 2000 },
];

const derive = (env) => ({ ...env, schemaVersion: 3, appVersion: '0.3.0', tables: { ...env.tables, aiMatches } });

const v2json = JSON.parse(readFileSync(new URL('./backup-v2.json', import.meta.url), 'utf8'));
writeFileSync(new URL('./backup-v3.json', import.meta.url), JSON.stringify(derive(v2json), null, 2) + '\n');

const files = unzipSync(new Uint8Array(readFileSync(new URL('./backup-v2.zip', import.meta.url))));
const env = derive(JSON.parse(new TextDecoder().decode(files['backup.json'])));
const out = {};
for (const [name, bytes] of Object.entries(files)) {
  out[name] = name === 'backup.json' ? [new TextEncoder().encode(JSON.stringify(env)), { level: 6 }] : [bytes, { level: 0 }];
}
writeFileSync(new URL('./backup-v3.zip', import.meta.url), zipSync(out, { mtime: new Date(Date.UTC(2026, 9, 1)) }));
console.log('wrote backup-v3.json and backup-v3.zip');
