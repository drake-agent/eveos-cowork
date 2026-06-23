#!/usr/bin/env node

const { execFileSync } = require('node:child_process');
const path = require('node:path');

const electronVersion = require('electron/package.json').version;
const runtime = process.argv[2] || 'electron';
const npmBin = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const electronRebuildBin = path.join(
  __dirname,
  '..',
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'electron-rebuild.cmd' : 'electron-rebuild'
);

if (runtime === 'node') {
  console.log('[rebuild] Rebuilding better-sqlite3 for local Node.js');
  execFileSync(npmBin, ['rebuild', 'better-sqlite3'], {
    stdio: 'inherit',
  });
  process.exit(0);
}

if (runtime !== 'electron') {
  console.error(`[rebuild] Unsupported runtime: ${runtime}`);
  console.error('[rebuild] Usage: node scripts/rebuild-native-modules.js [electron|node]');
  process.exit(2);
}

console.log(`[rebuild] Rebuilding better-sqlite3 for Electron ${electronVersion}`);

execFileSync(
  electronRebuildBin,
  ['--force', '--which-module', 'better-sqlite3', '--version', electronVersion],
  {
    stdio: 'inherit',
  }
);
