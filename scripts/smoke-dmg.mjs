#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import packageJson from '../package.json' with { type: 'json' };

const PRODUCT_NAME = 'EveOS Beauty';
const APP_BUNDLE_NAME = `${PRODUCT_NAME}.app`;

export function getDmgCandidates({
  root = process.cwd(),
  platform = process.platform,
  arch = process.arch,
  version = packageJson.version,
} = {}) {
  if (platform !== 'darwin') {
    return [];
  }

  return [
    path.join(root, 'release', `${PRODUCT_NAME}-${version}-mac-${arch}.dmg`),
    path.join(root, 'release', `${PRODUCT_NAME}-${version}-mac.dmg`),
  ];
}

export function resolveDmgArtifact({
  root = process.cwd(),
  platform = process.platform,
  arch = process.arch,
  version = packageJson.version,
  exists = fs.existsSync,
} = {}) {
  const candidates = getDmgCandidates({ root, platform, arch, version });
  const dmgPath = candidates.find((candidate) => exists(candidate));

  if (!dmgPath) {
    throw new Error(
      [
        'DMG artifact was not found.',
        'Run `npm run build` first, then retry `npm run smoke:dmg`.',
        'Checked candidates:',
        ...candidates.map((candidate) => `- ${candidate}`),
      ].join('\n')
    );
  }

  return dmgPath;
}

export function runDmgSmoke({
  root = process.cwd(),
  platform = process.platform,
  arch = process.arch,
  version = packageJson.version,
  exists = fs.existsSync,
  lstat = fs.lstatSync,
  mkdtemp = fs.mkdtempSync,
  rm = fs.rmSync,
  execFile = execFileSync,
  logger = console.log,
} = {}) {
  if (platform !== 'darwin') {
    const result = {
      ok: true,
      skipped: true,
      reason: 'DMG smoke only runs on macOS',
    };
    logger(`[dmg-smoke] skipped: ${result.reason}`);
    return result;
  }

  const dmgPath = resolveDmgArtifact({ root, platform, arch, version, exists });
  const mountPoint = mkdtemp(path.join(os.tmpdir(), 'eveos-beauty-dmg-'));
  let mounted = false;

  try {
    logger(`[dmg-smoke] dmg=${dmgPath}`);
    execFile('hdiutil', ['attach', dmgPath, '-mountpoint', mountPoint, '-nobrowse', '-readonly'], {
      stdio: 'inherit',
    });
    mounted = true;

    const appBundle = path.join(mountPoint, APP_BUNDLE_NAME);
    const applicationsLink = path.join(mountPoint, 'Applications');

    if (!exists(appBundle)) {
      throw new Error(`Mounted DMG did not contain ${APP_BUNDLE_NAME}: ${appBundle}`);
    }

    if (!exists(applicationsLink)) {
      throw new Error(`Mounted DMG did not contain Applications link: ${applicationsLink}`);
    }

    if (!lstat(applicationsLink).isSymbolicLink()) {
      throw new Error(`Mounted DMG Applications entry is not a symlink: ${applicationsLink}`);
    }

    logger('[dmg-smoke] DMG smoke passed');

    return {
      ok: true,
      dmgPath,
      appBundle,
      applicationsLink,
    };
  } finally {
    try {
      if (mounted) {
        execFile('hdiutil', ['detach', mountPoint], {
          stdio: 'inherit',
        });
      }
    } finally {
      rm(mountPoint, { recursive: true, force: true });
    }
  }
}

const currentFile = fileURLToPath(import.meta.url);

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  try {
    runDmgSmoke();
  } catch (error) {
    console.error(`[dmg-smoke] FAILED: ${error instanceof Error ? error.message : error}`);
    process.exitCode = 1;
  }
}

export const __filename = currentFile;
