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

  it('uses EveOS Beauty browser metadata and opens the Beauty OS surface by default', () => {
    const html = read('index.html');
    const store = read('src/renderer/store/index.ts');

    expect(html).toContain('<title>EveOS Beauty</title>');
    expect(html).not.toContain('<title>Open Cowork</title>');
    expect(store).toContain('showBeautyDesk: true');
  });

  it('documents the fork as an EveOS Beauty team client instead of upstream OpenCowork', () => {
    const readme = read('README.md');

    expect(readme).toContain('# EveOS Beauty');
    expect(readme).toContain('https://beauty.eveos.one');
    expect(readme).toContain('Cloudflare Access');
    expect(readme).toContain('Anna analyst queue');
    expect(readme).toContain('Decision packets');
    expect(readme).toContain('OpenCoworkAI/open-cowork');
    expect(readme).not.toContain('Open Cowork: Your Personal AI Agent Desktop App');
    expect(readme).not.toContain('brew tap OpenCoworkAI/tap');
    expect(readme).not.toContain('WeChat Group');
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

  it('uses EveOS Beauty identity in active runtime storage, logs, MCP, and web metadata', () => {
    expect(read('src/main/config/config-store.ts')).toContain("projectName: 'eveos-cowork'");
    expect(read('src/main/config/config-store.ts')).toContain(
      "stableKey: 'open-cowork-config-stable-v1'"
    );
    expect(read('src/main/config/config-store.ts')).toContain("'eveos-beauty-config-stable-v1'");
    expect(read('src/main/remote/remote-config-store.ts')).toContain("projectName: 'eveos-cowork'");
    expect(read('src/main/remote/remote-config-store.ts')).toContain(
      "stableKey: 'open-cowork-remote-stable-v1'"
    );
    expect(read('src/main/remote/remote-config-store.ts')).toContain(
      "'eveos-beauty-remote-stable-v1'"
    );
    expect(read('src/main/skills/plugin-registry-store.ts')).toContain(
      "projectName: 'eveos-cowork'"
    );
    expect(read('src/main/mcp/mcp-config-store.ts')).toContain("projectName: 'eveos-cowork'");

    for (const file of [
      'src/main/utils/logger.ts',
      'src/main/mcp/mcp-logger.ts',
      'src/main/mcp/gui-operate-server.ts',
    ]) {
      expect(read(file)).toContain('EveOS Beauty');
      expect(read(file)).not.toContain('Open Cowork');
    }

    expect(read('src/main/skills/plugin-catalog-service.ts')).toContain(
      "DEFAULT_USER_AGENT = 'eveos-beauty-plugin-catalog/0.1'"
    );
    expect(read('src/main/mcp/mcp-manager.ts')).toContain("name: 'eveos-beauty'");
    expect(read('src/main/tools/tool-executor.ts')).toContain(
      "headers: { 'User-Agent': 'eveos-beauty' }"
    );
    expect(read('src/main/tools/sandbox-tool-executor.ts')).toContain(
      "headers: { 'User-Agent': 'eveos-beauty' }"
    );
  });
});
