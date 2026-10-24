// 架構守門：src/core 必須是純函式，不能依賴 React、Dexie 或瀏覽器 API。

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const coreDir = fileURLToPath(new URL('../../src/core', import.meta.url));

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.ts') && !p.endsWith('.test.ts') ? [p] : [];
  });
}

describe('src/core 純度', () => {
  const files = walk(coreDir);
  it('至少有檔案', () => expect(files.length).toBeGreaterThan(3));
  it.each(files)('%s', (file) => {
    const src = readFileSync(file, 'utf8');
    const imports = [...src.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]!);
    for (const spec of imports) {
      expect(spec, `${file} 不可 import ${spec}`).toMatch(/^(\.|\.\.)\//);
      expect(spec, `${file} 不可 import db/features/ui`).not.toMatch(/\/(db|features|ui|lib)\//);
    }
    expect(src).not.toMatch(/\b(window|document|localStorage|indexedDB)\./);
  });
});
