import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const root = fileURLToPath(new URL('../public/', import.meta.url));
const directions = [['signal', 'ciklum', 24], ['human', 'andela', 25], ['atlas', 'nityo', 31]];

for (const [slug, alias, count] of directions) {
  test(`${slug}: complete page inventory and reviewer alias`, () => {
    const raw = readFileSync(path.join(root, 'replicas', slug, 'manifest.json'), 'utf8');
    const manifest = JSON.parse(raw);
    assert.equal(manifest.pages.length, count);
    assert.equal(new Set(manifest.pages.map(page => page.id)).size, count);
    assert.equal(readFileSync(path.join(root, 'replicas', alias, 'manifest.json'), 'utf8'), raw);
    for (const page of manifest.pages) {
      assert.ok(existsSync(path.join(root, page.file)), page.file);
    }
  });

  test(`${slug}: page assets remain local and available`, () => {
    const manifest = JSON.parse(readFileSync(path.join(root, 'replicas', slug, 'manifest.json'), 'utf8'));
    for (const page of manifest.pages) {
      const file = path.join(root, page.file);
      const html = readFileSync(file, 'utf8');
      for (const match of html.matchAll(/(?:src|poster|data-src)=["']([^"']+)["']/g)) {
        const url = match[1].split(/[?#]/)[0];
        if (!url || /^(?:https?:|data:|blob:|\/\/)/.test(url)) continue;
        const target = url.startsWith('/') ? path.join(root, url) : path.join(path.dirname(file), url);
        assert.ok(existsSync(target), `${page.id}: ${url}`);
      }
    }
  });
}
