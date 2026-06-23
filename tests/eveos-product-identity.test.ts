import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

describe('EveOS Beauty product identity', () => {
  it('renames package and installer metadata away from the upstream app', () => {
    const pkg = JSON.parse(read('package.json'));
    const builder = read('electron-builder.yml');

    expect(pkg.name).toBe('eveos-cowork');
    expect(pkg.description).toContain('EveOS Beauty OS');
    expect(pkg.homepage).toBe('https://github.com/drake-agent/eveos-cowork');
    expect(builder).toContain('appId: com.eveos.beauty');
    expect(builder).toContain('productName: EveOS Beauty');
    expect(builder).toContain("name: 'EveOS Beauty.app'");
  });

  it('uses EveOS Beauty branding in visible renderer shell copy', () => {
    const rendererFiles = [
      'src/renderer/components/Sidebar.tsx',
      'src/renderer/components/WelcomeView.tsx',
      'src/renderer/components/ChatView.tsx',
      'src/renderer/components/SettingsPanel.tsx',
      'src/renderer/components/settings/SettingsGeneral.tsx',
      'src/renderer/i18n/locales/en.json',
      'src/renderer/i18n/locales/zh.json',
    ];

    for (const file of rendererFiles) {
      const source = read(file);
      expect(source).toContain('EveOS Beauty');
      expect(source).not.toContain('Open Cowork');
    }
  });

  it('keeps a reproducible BANILA-style icon source and generated app assets', () => {
    expect(fs.existsSync(path.join(root, 'scripts/generate-eveos-beauty-icons.py'))).toBe(true);
    expect(fs.existsSync(path.join(root, 'resources/icon.png'))).toBe(true);
    expect(fs.existsSync(path.join(root, 'resources/icon.icns'))).toBe(true);
    expect(fs.existsSync(path.join(root, 'resources/icon.ico'))).toBe(true);
    expect(fs.existsSync(path.join(root, 'resources/tray-icon.png'))).toBe(true);
    expect(fs.existsSync(path.join(root, 'resources/tray-iconTemplate.png'))).toBe(true);
    expect(fs.existsSync(path.join(root, 'public/favicon.png'))).toBe(true);
    expect(fs.existsSync(path.join(root, 'src/renderer/assets/logo.png'))).toBe(true);
  });
});
