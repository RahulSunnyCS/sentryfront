#!/usr/bin/env node
/**
 * Corpus CLI — thin wrapper around `vitest run` for the Phase 3.6 scan
 * corpus. See docs/core/CORPUS_GUIDE.md.
 *
 *   yarn corpus replay                   # replay all recordings (CI default)
 *   yarn corpus record --site <slug>     # record a single site against the
 *                                        # live network
 *   yarn corpus record --all             # record every slug in the corpus
 *
 * The wrapper sets CORPUS_MODE / CORPUS_SITES then execs vitest on
 * src/__tests__/lib/scanner/corpus. All TS handling happens inside vitest;
 * no extra runtime is required.
 */
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

const CORPUS_TEST_PATH = 'src/__tests__/lib/scanner/corpus';

function parseArgs(argv) {
  const [cmd, ...rest] = argv;
  const sites = [];
  let all = false;
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    if (arg === '--site') {
      const next = rest[i + 1];
      if (!next) throw new Error('--site requires a slug argument');
      sites.push(next);
      i++;
    } else if (arg === '--all') {
      all = true;
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }
  return { cmd, sites, all };
}

function printHelp() {
  console.log(`Usage:
  yarn corpus replay
  yarn corpus record --site <slug> [--site <slug>...]
  yarn corpus record --all

Slugs live under src/__tests__/fixtures/corpus/<slug>/meta.json.
Recording requires real network access; replay does not.`);
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0 || argv[0] === '--help' || argv[0] === '-h') {
    printHelp();
    process.exit(0);
  }

  let parsed;
  try {
    parsed = parseArgs(argv);
  } catch (err) {
    console.error(err.message);
    printHelp();
    process.exit(2);
  }

  const env = { ...process.env };
  if (parsed.cmd === 'record') {
    env.CORPUS_MODE = 'record';
    if (!parsed.all && parsed.sites.length === 0) {
      console.error('record requires --site <slug> or --all');
      process.exit(2);
    }
    env.CORPUS_SITES = parsed.all ? 'all' : parsed.sites.join(',');
  } else if (parsed.cmd === 'replay') {
    env.CORPUS_MODE = 'replay';
  } else {
    console.error(`unknown command: ${parsed.cmd}`);
    printHelp();
    process.exit(2);
  }

  const vitestBin = path.join('node_modules', '.bin', 'vitest');
  if (!fs.existsSync(vitestBin)) {
    console.error(`vitest binary not found at ${vitestBin}; run yarn install first`);
    process.exit(1);
  }

  const child = spawn(vitestBin, ['run', CORPUS_TEST_PATH], {
    env,
    stdio: 'inherit',
  });
  child.on('exit', (code) => process.exit(code ?? 0));
}

main();
