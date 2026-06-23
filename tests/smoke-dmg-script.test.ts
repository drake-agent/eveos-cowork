import { describe, expect, it, vi } from 'vitest';
import path from 'node:path';

async function loadDmgSmokeModule() {
  return await import('../scripts/smoke-dmg.mjs');
}

describe('DMG smoke script', () => {
  it('resolves the macOS DMG artifact from release output', async () => {
    const { resolveDmgArtifact } = await loadDmgSmokeModule();
    const root = '/tmp/eveos-cowork';
    const expected = path.join(root, 'release', 'EveOS Beauty-0.1.0-mac-arm64.dmg');

    expect(
      resolveDmgArtifact({
        root,
        platform: 'darwin',
        arch: 'arm64',
        version: '0.1.0',
        exists: (candidate: string) => candidate === expected,
      })
    ).toBe(expected);
  });

  it('mounts the DMG read-only, verifies app contents, and unmounts it', async () => {
    const { runDmgSmoke } = await loadDmgSmokeModule();
    const root = '/tmp/eveos-cowork';
    const dmgPath = path.join(root, 'release', 'EveOS Beauty-0.1.0-mac-arm64.dmg');
    const mountPoint = '/tmp/eveos-beauty-dmg-test';
    const appBundle = path.join(mountPoint, 'EveOS Beauty.app');
    const applicationsLink = path.join(mountPoint, 'Applications');
    const execFile = vi.fn();
    const rm = vi.fn();
    const logs: string[] = [];

    const result = runDmgSmoke({
      root,
      platform: 'darwin',
      arch: 'arm64',
      version: '0.1.0',
      exists: (candidate: string) =>
        candidate === dmgPath || candidate === appBundle || candidate === applicationsLink,
      lstat: (candidate: string) => ({
        isSymbolicLink: () => candidate === applicationsLink,
      }),
      mkdtemp: () => mountPoint,
      rm,
      execFile,
      logger: (message: string) => logs.push(message),
    });

    expect(result).toEqual({
      ok: true,
      dmgPath,
      appBundle,
      applicationsLink,
    });
    expect(execFile).toHaveBeenNthCalledWith(
      1,
      'hdiutil',
      ['attach', dmgPath, '-mountpoint', mountPoint, '-nobrowse', '-readonly'],
      { stdio: 'inherit' }
    );
    expect(execFile).toHaveBeenNthCalledWith(2, 'hdiutil', ['detach', mountPoint], {
      stdio: 'inherit',
    });
    expect(rm).toHaveBeenCalledWith(mountPoint, { recursive: true, force: true });
    expect(logs.join('\n')).toContain('DMG smoke passed');
    expect(logs.join('\n')).not.toContain('EVEOS_BEAUTY_API_TOKEN');
  });

  it('detaches and removes the mount point when mounted DMG verification fails', async () => {
    const { runDmgSmoke } = await loadDmgSmokeModule();
    const root = '/tmp/eveos-cowork';
    const dmgPath = path.join(root, 'release', 'EveOS Beauty-0.1.0-mac-arm64.dmg');
    const mountPoint = '/tmp/eveos-beauty-dmg-test';
    const applicationsLink = path.join(mountPoint, 'Applications');
    const execFile = vi.fn();
    const rm = vi.fn();

    expect(() =>
      runDmgSmoke({
        root,
        platform: 'darwin',
        arch: 'arm64',
        version: '0.1.0',
        exists: (candidate: string) => candidate === dmgPath || candidate === applicationsLink,
        lstat: () => ({
          isSymbolicLink: () => true,
        }),
        mkdtemp: () => mountPoint,
        rm,
        execFile,
        logger: vi.fn(),
      })
    ).toThrow('Mounted DMG did not contain EveOS Beauty.app');

    expect(execFile).toHaveBeenNthCalledWith(2, 'hdiutil', ['detach', mountPoint], {
      stdio: 'inherit',
    });
    expect(rm).toHaveBeenCalledWith(mountPoint, { recursive: true, force: true });
  });

  it('still removes the temporary mount point when detach fails', async () => {
    const { runDmgSmoke } = await loadDmgSmokeModule();
    const root = '/tmp/eveos-cowork';
    const dmgPath = path.join(root, 'release', 'EveOS Beauty-0.1.0-mac-arm64.dmg');
    const mountPoint = '/tmp/eveos-beauty-dmg-test';
    const appBundle = path.join(mountPoint, 'EveOS Beauty.app');
    const applicationsLink = path.join(mountPoint, 'Applications');
    const rm = vi.fn();
    const execFile = vi.fn((_command: string, args: string[]) => {
      if (args[0] === 'detach') {
        throw new Error('detach failed');
      }
    });

    expect(() =>
      runDmgSmoke({
        root,
        platform: 'darwin',
        arch: 'arm64',
        version: '0.1.0',
        exists: (candidate: string) =>
          candidate === dmgPath || candidate === appBundle || candidate === applicationsLink,
        lstat: () => ({
          isSymbolicLink: () => true,
        }),
        mkdtemp: () => mountPoint,
        rm,
        execFile,
        logger: vi.fn(),
      })
    ).toThrow('detach failed');

    expect(rm).toHaveBeenCalledWith(mountPoint, { recursive: true, force: true });
  });

  it('skips DMG verification on non-macOS platforms', async () => {
    const { runDmgSmoke } = await loadDmgSmokeModule();
    const logs: string[] = [];

    expect(
      runDmgSmoke({
        platform: 'linux',
        logger: (message: string) => logs.push(message),
      })
    ).toEqual({
      ok: true,
      skipped: true,
      reason: 'DMG smoke only runs on macOS',
    });
    expect(logs.join('\n')).toContain('skipped');
  });
});
