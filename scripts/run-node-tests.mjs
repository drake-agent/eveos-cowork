#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export function resolveBundledNodeRuntime({
  root = process.cwd(),
  platform = process.platform,
  arch = process.arch,
  exists = fs.existsSync,
} = {}) {
  const runtimeDir = path.join(root, 'resources', 'node', `${platform}-${arch}`);
  const nodePath =
    platform === 'win32' ? path.join(runtimeDir, 'node.exe') : path.join(runtimeDir, 'bin', 'node');
  const npmCliPath =
    platform === 'win32'
      ? path.join(runtimeDir, 'node_modules', 'npm', 'bin', 'npm-cli.js')
      : path.join(runtimeDir, 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js');

  if (!exists(nodePath) || !exists(npmCliPath)) {
    return null;
  }

  return { nodePath, npmCliPath };
}

export function runNodeTests({
  root = process.cwd(),
  platform = process.platform,
  arch = process.arch,
  args = process.argv.slice(2),
  exists = fs.existsSync,
  execFile = execFileSync,
  logger = console.log,
} = {}) {
  const vitestPath = path.join(root, 'node_modules', 'vitest', 'vitest.mjs');
  if (!exists(vitestPath)) {
    throw new Error(`Vitest entrypoint was not found: ${vitestPath}`);
  }

  const bundledRuntime = resolveBundledNodeRuntime({ root, platform, arch, exists });
  const execOptions = {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env },
  };

  if (bundledRuntime) {
    const binDir = path.dirname(bundledRuntime.nodePath);
    execOptions.env.PATH = `${binDir}${path.delimiter}${process.env.PATH || ''}`;
    logger(`[test] Using bundled Node: ${bundledRuntime.nodePath}`);
    execFile(bundledRuntime.nodePath, [bundledRuntime.npmCliPath, 'rebuild', 'better-sqlite3'], {
      ...execOptions,
    });
    execFile(bundledRuntime.nodePath, [vitestPath, ...args], {
      ...execOptions,
    });
    return {
      ok: true,
      nodePath: bundledRuntime.nodePath,
      npmCliPath: bundledRuntime.npmCliPath,
      vitestPath,
      usedBundledNode: true,
    };
  }

  logger('[test] Bundled Node runtime not found; using current Node process.');
  execFile(process.execPath, [path.join(root, 'scripts', 'rebuild-native-modules.js'), 'node'], {
    ...execOptions,
  });
  execFile(process.execPath, [vitestPath, ...args], {
    ...execOptions,
  });
  return {
    ok: true,
    nodePath: process.execPath,
    npmCliPath: '',
    vitestPath,
    usedBundledNode: false,
  };
}

const currentFile = fileURLToPath(import.meta.url);

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  try {
    runNodeTests();
  } catch (error) {
    console.error(`[test] FAILED: ${error instanceof Error ? error.message : error}`);
    process.exitCode = 1;
  }
}

export const __filename = currentFile;
