'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const routePath = path.resolve(__dirname, '../routes/scan.js');

test('closed W.cash wallet routes do not initialize a compact-block cache', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wcashscan-scan-cache-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const cacheDir = path.join(root, 'nested', 'compact-blocks');
  const result = spawnSync(process.execPath, ['-e', `require(${JSON.stringify(routePath)})`], {
    encoding: 'utf8',
    env: { ...process.env, COMPACT_BLOCK_CACHE_DIR: cacheDir },
  });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.existsSync(cacheDir), false);
  assert.doesNotMatch(result.stderr, /compact block cache/i);
});
