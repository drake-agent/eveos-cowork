#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const PRODUCT_NAME = 'EveOS Beauty';
const APP_BUNDLE_NAME = `${PRODUCT_NAME}.app`;

export function getPackagedAppExecutableCandidates({
  root = process.cwd(),
  platform = process.platform,
  arch = process.arch,
} = {}) {
  if (platform === 'darwin') {
    return [
      path.join(root, 'release', `mac-${arch}`, APP_BUNDLE_NAME, 'Contents', 'MacOS', PRODUCT_NAME),
      path.join(root, 'release', 'mac', APP_BUNDLE_NAME, 'Contents', 'MacOS', PRODUCT_NAME),
    ];
  }

  if (platform === 'win32') {
    return [
      path.join(root, 'release', 'win-unpacked', `${PRODUCT_NAME}.exe`),
      path.join(root, 'release', `win-${arch}-unpacked`, `${PRODUCT_NAME}.exe`),
    ];
  }

  return [
    path.join(root, 'release', 'linux-unpacked', 'eveos-beauty'),
    path.join(root, 'release', `linux-${arch}-unpacked`, 'eveos-beauty'),
    path.join(root, 'release', 'linux-unpacked', 'eveos-cowork'),
  ];
}

export function resolvePackagedAppExecutable({
  root = process.cwd(),
  platform = process.platform,
  arch = process.arch,
  exists = fs.existsSync,
} = {}) {
  const candidates = getPackagedAppExecutableCandidates({ root, platform, arch });
  const executable = candidates.find((candidate) => exists(candidate));

  if (!executable) {
    throw new Error(
      [
        'Packaged app executable was not found.',
        'Run `npm run build` first, then retry `npm run smoke:package-app`.',
        'Checked candidates:',
        ...candidates.map((candidate) => `- ${candidate}`),
      ].join('\n')
    );
  }

  return executable;
}

export function runPackagedAppSmoke({
  root = process.cwd(),
  platform = process.platform,
  arch = process.arch,
  exists = fs.existsSync,
  execFile = execFileSync,
  logger = console.log,
} = {}) {
  const executable = resolvePackagedAppExecutable({ root, platform, arch, exists });

  logger(`[package-smoke] executable=${executable}`);
  execFile(executable, ['--smoke-test'], {
    stdio: 'inherit',
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '',
    },
  });
  logger('[package-smoke] Packaged app smoke passed');

  return { ok: true, executable };
}

const currentFile = fileURLToPath(import.meta.url);

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  try {
    runPackagedAppSmoke();
  } catch (error) {
    console.error(`[package-smoke] FAILED: ${error instanceof Error ? error.message : error}`);
    process.exitCode = 1;
  }
}

export const __filename = currentFile;
