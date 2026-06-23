import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const packagePath = path.join(root, 'package.json');
const rebuildScriptPath = path.join(root, 'scripts/rebuild-native-modules.js');
const mainPath = path.join(root, 'src/main/index.ts');

describe('native module scripts', () => {
  it('uses a dedicated Electron rebuild script instead of deprecated npm config flags', () => {
    const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8')) as {
      scripts: Record<string, string>;
    };

    expect(pkg.scripts.rebuild).toBe('node scripts/rebuild-native-modules.js electron');
    expect(pkg.scripts['rebuild:electron']).toBe('node scripts/rebuild-native-modules.js electron');
    expect(pkg.scripts['rebuild:node']).toBe('node scripts/rebuild-native-modules.js node');
    expect(pkg.scripts.test).toBe('node scripts/run-node-tests.mjs');
    expect(pkg.scripts.rebuild).not.toContain('--runtime=');
    expect(pkg.scripts.rebuild).not.toContain('--target=');
    expect(pkg.scripts.rebuild).not.toContain('--disturl=');
    expect(fs.existsSync(rebuildScriptPath)).toBe(true);

    const rebuildScript = fs.readFileSync(rebuildScriptPath, 'utf8');
    expect(rebuildScript).toContain('electron-rebuild');
    expect(rebuildScript).toContain('better-sqlite3');
    expect(rebuildScript).toContain("runtime === 'node'");
    expect(rebuildScript).toContain("runtime !== 'electron'");
    expect(rebuildScript).not.toContain('npm_config_runtime');
    expect(rebuildScript).not.toContain('npm_config_target');
    expect(rebuildScript).not.toContain('npm_config_disturl');
  });

  it('provides a repeatable Electron startup smoke test', () => {
    const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8')) as {
      scripts: Record<string, string>;
    };

    expect(pkg.scripts['smoke:electron']).toBe(
      'npm run rebuild:electron && vite build && electron . --smoke-test'
    );
    expect(pkg.scripts['smoke:package-app']).toBe('node scripts/smoke-packaged-app.mjs');
    expect(pkg.scripts['smoke:dmg']).toBe('node scripts/smoke-dmg.mjs');
    expect(pkg.scripts['smoke:package-real']).toBe(
      'npm run build && npm run smoke:package-app && npm run smoke:dmg && npm run smoke:beauty-api'
    );
    expect(fs.existsSync(path.join(root, 'scripts/smoke-packaged-app.mjs'))).toBe(true);
    expect(fs.existsSync(path.join(root, 'scripts/smoke-dmg.mjs'))).toBe(true);
  });

  it('rebuilds Electron native modules before starting the dev Electron app', () => {
    const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8')) as {
      scripts: Record<string, string>;
    };

    expect(pkg.scripts.dev).toBe(
      'npm run download:node && npm run rebuild:electron && npm run build:wsl-agent && npm run build:lima-agent && npm run build:mcp && vite'
    );
    expect(pkg.scripts['dev:with-python']).toBe(
      'npm run download:node && npm run rebuild:electron && npm run prepare:python && npm run build:wsl-agent && npm run build:lima-agent && npm run build:mcp && vite'
    );
  });

  it('keeps Electron smoke mode from continuing into normal app startup', () => {
    const mainSource = fs.readFileSync(mainPath, 'utf8');

    expect(mainSource).toContain("if (process.argv.includes('--smoke-test'))");
    expect(mainSource).toContain('app.exit(0);');
    expect(mainSource).toContain('return;');
    expect(mainSource).not.toContain('process.exit(0);');
    expect(mainSource).not.toContain('process.exit(1);');
  });
});
