import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const script = path.join(root, 'scripts/wcash-rpc-preflight.mjs');
const regtestGenesis = '70bf0bab17eff361a6331bb825b3b7253c8c96ff96407f948161d2912658bb1c';

function startRpc({ genesis = regtestGenesis, chain = 'regtest', subversion = '/Wolf:0.1.0/', branch = 'c3a6678a' } = {}) {
  const server = createServer(async (request, response) => {
    let body = '';
    for await (const chunk of request) body += chunk;
    const payload = JSON.parse(body);
    let result;
    switch (payload.method) {
      case 'getblockhash':
        result = Number(payload.params?.[0]) === 0 ? genesis : '11'.repeat(32);
        break;
      case 'getblockcount':
        result = 0;
        break;
      case 'getblockchaininfo':
        result = { chain, consensus: { nextblock: branch } };
        break;
      case 'getnetworkinfo':
        result = { subversion };
        break;
      case 'getblock':
        result = { hash: genesis, height: 0, size: 140, tx: [] };
        break;
      default:
        response.writeHead(404, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ error: { code: -32601, message: 'method not found' } }));
        return;
    }
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ jsonrpc: '2.0', id: payload.id, result }));
  });
  server.listen(0, '127.0.0.1');
  return server;
}

async function runPreflight(server, extra = {}) {
  const { port } = server.address();
  const child = spawn(process.execPath, [script, '--profile', 'wcash-regtest', '--rpc-url', `http://127.0.0.1:${port}`], {
    cwd: root,
    env: {
      ...process.env,
      WCASH_CHAIN: 'wcash-regtest',
      WCASH_RPC_COOKIE_FILE: '',
      ZEBRA_RPC_URL: '',
      ...extra,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', chunk => { stdout += chunk; });
  child.stderr.on('data', chunk => { stderr += chunk; });
  const [result] = await once(child, 'close');
  return { code: result, stdout, stderr };
}

test('Wcash regtest RPC preflight accepts a matching local Wolf contract', async t => {
  const server = startRpc();
  await once(server, 'listening');
  t.after(() => server.close());

  const result = await runPreflight(server);
  assert.equal(result.code, 0, result.stderr || result.stdout);
  const marker = '\nWcash RPC preflight passed:';
  const markerIndex = result.stdout.indexOf(marker);
  assert.notEqual(markerIndex, -1, result.stdout);
  const evidence = JSON.parse(result.stdout.slice(0, markerIndex));
  assert.equal(evidence.profile, 'wcash-regtest');
  assert.equal(evidence.height, 0);
  assert.equal(evidence.genesisBlock.hash, regtestGenesis);
});

test('Wcash RPC preflight rejects a wrong genesis or non-Wolf node', async t => {
  const server = startRpc({ genesis: '00'.repeat(32), subversion: '/Zcash:6.0.0/' });
  await once(server, 'listening');
  t.after(() => server.close());

  const result = await runPreflight(server);
  assert.notEqual(result.code, 0);
  assert.match(`${result.stdout}\n${result.stderr}`, /genesis mismatch/i);
});

test('Wcash RPC preflight rejects a node with the wrong post-genesis branch', async t => {
  const server = startRpc({ branch: 'b3cfd27e' });
  await once(server, 'listening');
  t.after(() => server.close());

  const result = await runPreflight(server);
  assert.notEqual(result.code, 0);
  assert.match(`${result.stdout}\n${result.stderr}`, /consensus branch mismatch/i);
});
