import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

async function loadRunNodeTestsModule() {
  return await import('../scripts/run-node-tests.mjs');
}

describe('Node test runner script', () => {
  it('routes npm test through the repo-managed Node runtime', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };

    expect(pkg.scripts.test).toBe('node scripts/run-node-tests.mjs');
    expect(fs.existsSync(path.join(root, 'scripts/run-node-tests.mjs'))).toBe(true);
  });

  it('uses bundled Node and npm CLI for native rebuild before running Vitest', async () => {
    const { runNodeTests } = await loadRunNodeTestsModule();
    const calls: Array<{ command: string; args: string[] }> = [];
    const execFile = vi.fn((command: string, args: string[]) => {
      calls.push({ command, args });
    });
    const logs: string[] = [];
    const fakeRoot = '/tmp/eveos-cowork';
    const nodePath = path.join(fakeRoot, 'resources', 'node', 'darwin-arm64', 'bin', 'node');
    const npmCliPath = path.join(
      fakeRoot,
      'resources',
      'node',
      'darwin-arm64',
      'lib',
      'node_modules',
      'npm',
      'bin',
      'npm-cli.js'
    );
    const vitestPath = path.join(fakeRoot, 'node_modules', 'vitest', 'vitest.mjs');

    const result = runNodeTests({
      root: fakeRoot,
      platform: 'darwin',
      arch: 'arm64',
      args: ['--run', 'tests/native-module-scripts.test.ts'],
      exists: (candidate: string) =>
        candidate === nodePath || candidate === npmCliPath || candidate === vitestPath,
      execFile,
      logger: (message: string) => logs.push(message),
    });

    expect(result).toEqual({
      ok: true,
      nodePath,
      npmCliPath,
      vitestPath,
      usedBundledNode: true,
    });
    expect(calls).toEqual([
      { command: nodePath, args: [npmCliPath, 'rebuild', 'better-sqlite3'] },
      { command: nodePath, args: [vitestPath, '--run', 'tests/native-module-scripts.test.ts'] },
    ]);
    expect(logs.join('\n')).toContain('bundled Node');
  });
});
