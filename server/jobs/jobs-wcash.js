#!/usr/bin/env node

/**
 * The only background-job entrypoint for the W.cash deployment.
 *
 * Keeping an explicit allowlist prevents an old cron manifest from starting
 * foreign-chain, pricing, bridge, or legacy jobs by accident.
 */

const { spawn } = require('node:child_process');
const path = require('node:path');

const JOBS = {
  stats: 'update-wcash-stats.js',
  snapshots: 'snapshot-wcash-chain.js',
  mining: 'snapshot-wcash-mining.js',
  turnstile: 'refresh-wcash-turnstile.js',
  anomalies: 'detect-wcash-anomalies.js',
};

function runChild(file, extraEnv = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(__dirname, file)], {
      stdio: 'inherit',
      env: { ...process.env, ...extraEnv },
    });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${file} exited with ${code ?? `signal ${signal}`}`));
    });
  });
}

async function runOnce({ backfill = false } = {}) {
  const requested = process.env.WCASH_JOB || 'all';
  const names = requested === 'all' ? Object.keys(JOBS) : requested.split(',').map((name) => name.trim());
  for (const name of names) {
    if (!JOBS[name]) throw new Error(`Unsupported WCASH_JOB '${name}'. Allowed: ${Object.keys(JOBS).join(', ')}`);
    await runChild(JOBS[name], backfill ? {
      WCASH_JOB_BACKFILL: '1',
      WCASH_TURNSTILE_REBUILD: '1',
      WCASH_MINING_DAYS: process.env.WCASH_MINING_DAYS || '30',
    } : {});
  }
}

async function main() {
  const command = process.argv[2] || 'run-once';
  if (command === 'run-once' || command === 'backfill') {
    const flags = process.argv.slice(3);
    const unknown = flags.filter((flag) => flag !== '--from-genesis' && !flag.startsWith('--job='));
    if (unknown.length) throw new Error(`Unknown jobs-wcash option(s): ${unknown.join(', ')}`);
    const requestedJob = flags.find((flag) => flag.startsWith('--job='));
    if (requestedJob) process.env.WCASH_JOB = requestedJob.slice('--job='.length);
    await runOnce({ backfill: command === 'backfill' || flags.includes('--from-genesis') });
    return;
  }
  if (command === 'serve') {
    const interval = Math.max(60_000, Number(process.env.WCASH_JOB_INTERVAL_MS || 3_600_000));
    while (true) {
      try { await runOnce(); } catch (error) { console.error(`[jobs-wcash] ${error.message}`); }
      await new Promise((resolve) => setTimeout(resolve, interval));
    }
  }
  throw new Error(`Unknown command '${command}'. Use run-once, backfill or serve.`);
}

if (require.main === module) main().catch((error) => { console.error(`[jobs-wcash] ${error.message}`); process.exitCode = 1; });

module.exports = { JOBS, runOnce };
