import { describe, expect, it, vi } from 'vitest';
import path from 'node:path';

async function loadPackageSmokeModule() {
  return await import('../scripts/smoke-packaged-app.mjs');
}

describe('packaged app smoke script', () => {
  it('resolves the macOS dir-target app executable from release/mac-arm64', async () => {
    const { resolvePackagedAppExecutable } = await loadPackageSmokeModule();
    const root = '/tmp/eveos-cowork';
    const expected = path.join(
      root,
      'release',
      'mac-arm64',
      'EveOS Beauty.app',
      'Contents',
      'MacOS',
      'EveOS Beauty'
    );

    expect(
      resolvePackagedAppExecutable({
        root,
        platform: 'darwin',
        arch: 'arm64',
        exists: (candidate: string) => candidate === expected,
      })
    ).toBe(expected);
  });

  it('launches the packaged app with smoke-test mode and does not require API tokens', async () => {
    const { runPackagedAppSmoke } = await loadPackageSmokeModule();
    const root = '/tmp/eveos-cowork';
    const executable = path.join(
      root,
      'release',
      'mac-arm64',
      'EveOS Beauty.app',
      'Contents',
      'MacOS',
      'EveOS Beauty'
    );
    const execFile = vi.fn();
    const logs: string[] = [];

    const result = runPackagedAppSmoke({
      root,
      platform: 'darwin',
      arch: 'arm64',
      exists: (candidate: string) => candidate === executable,
      execFile,
      logger: (message: string) => logs.push(message),
    });

    expect(result).toEqual({ ok: true, executable });
    expect(execFile).toHaveBeenCalledWith(
      executable,
      ['--smoke-test'],
      expect.objectContaining({
        stdio: 'inherit',
      })
    );
    expect(logs.join('\n')).toContain('Packaged app smoke passed');
    expect(logs.join('\n')).not.toContain('EVEOS_BEAUTY_API_TOKEN');
  });
});
