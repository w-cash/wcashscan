#!/usr/bin/env node

import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const apiRequire = createRequire(path.join(workspaceRoot, 'server/api/server.js'));
const express = apiRequire('express');
const grpc = apiRequire('@grpc/grpc-js');
const protoLoader = apiRequire('@grpc/proto-loader');

process.env.COMPACT_BLOCK_CACHE_ENABLED = '0';
process.env.LIGHTWALLETD_ADDRESS = process.env.WCASH_REGTEST_LIGHTWALLETD_ADDRESS || '127.0.0.1:48234';

const protoPath = path.join(workspaceRoot, 'server/api/proto/service.proto');
const definition = protoLoader.loadSync(protoPath, { includeDirs: [path.dirname(protoPath)] });
const rpcPackage = grpc.loadPackageDefinition(definition).cash.z.wallet.sdk.rpc;
const CompactTxStreamer = rpcPackage.CompactTxStreamer;
const scanRouter = apiRequire('./routes/scan.js');

function asNumber(value) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number(value);
  if (value && typeof value.low === 'number') return value.low + (value.high || 0) * 2 ** 32;
  return NaN;
}

function unary(client, method, request) {
  return new Promise((resolve, reject) => {
    client[method](request, (error, response) => (error ? reject(error) : resolve(response)));
  });
}

async function main() {
  const directClient = new CompactTxStreamer(
    process.env.LIGHTWALLETD_ADDRESS,
    grpc.credentials.createInsecure(),
  );
  const latest = await unary(directClient, 'GetLatestBlock', {});
  directClient.close();

  const endHeight = asNumber(latest.height);
  const startHeight = Math.max(1, endHeight - 2);
  const app = express();
  app.use(express.json());
  app.locals.CompactTxStreamer = CompactTxStreamer;
  app.locals.grpc = grpc;
  app.use(scanRouter);

  const server = await new Promise((resolve) => {
    const candidate = app.listen(0, '127.0.0.1', () => resolve(candidate));
  });

  try {
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    const batchResponse = await fetch(`${baseUrl}/api/lightwalletd/scan`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ startHeight }),
    });
    if (!batchResponse.ok) throw new Error(`batch scan returned HTTP ${batchResponse.status}: ${await batchResponse.text()}`);
    const batch = await batchResponse.json();
    const batchHeights = batch.blocks.map((block) => asNumber(block.height));
    if (batch.endHeight !== endHeight || batchHeights.join(',') !== `${startHeight},${startHeight + 1},${endHeight}`) {
      throw new Error(`batch scan returned an unexpected range: ${JSON.stringify({ startHeight: batch.startHeight, endHeight: batch.endHeight, blocks: batchHeights })}`);
    }

    const streamResponse = await fetch(`${baseUrl}/api/lightwalletd/scan`, {
      method: 'POST',
      headers: { 'accept-encoding': 'identity', 'content-type': 'application/json' },
      body: JSON.stringify({ startHeight, endHeight, format: 'inbox-stream-v1' }),
    });
    if (!streamResponse.ok) throw new Error(`stream scan returned HTTP ${streamResponse.status}`);
    const records = (await streamResponse.text()).trim().split('\n').map((line) => JSON.parse(line));
    const endRecord = records.at(-1);
    const streamedBlocks = records.filter((record) => record.type === 'blocks').flatMap((record) => record.blocks || []);
    const streamedHeights = streamedBlocks.map((block) => asNumber(block.height));
    if (records[0]?.type !== 'start' || endRecord?.type !== 'end' || endRecord.blocksScanned !== 3 ||
        streamedHeights.join(',') !== `${startHeight},${startHeight + 1},${endHeight}`) {
      throw new Error(`stream scan did not complete a three-block range: ${JSON.stringify({ first: records[0], last: endRecord })}`);
    }

    console.log(`Wcash local regtest scanner passed: lightwalletd=${process.env.LIGHTWALLETD_ADDRESS}, range=${startHeight}-${endHeight}, blocks=${batch.blocks.length}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

try {
  await main();
} catch (error) {
  console.error(`Wcash local regtest scanner check failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
