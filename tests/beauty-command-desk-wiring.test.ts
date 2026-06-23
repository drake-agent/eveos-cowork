import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const appPath = path.join(root, 'src/renderer/App.tsx');
const sidebarPath = path.join(root, 'src/renderer/components/Sidebar.tsx');
const storePath = path.join(root, 'src/renderer/store/index.ts');
const deskPath = path.join(root, 'src/renderer/components/beauty/BeautyCommandDesk.tsx');

describe('Beauty Command Desk wiring', () => {
  it('adds a dedicated Beauty OS surface reachable from the shell', () => {
    expect(existsSync(deskPath)).toBe(true);

    const app = readFileSync(appPath, 'utf8');
    const sidebar = readFileSync(sidebarPath, 'utf8');
    const store = readFileSync(storePath, 'utf8');

    expect(app).toContain('BeautyCommandDesk');
    expect(app).toContain('showBeautyDesk');
    expect(sidebar).toContain('setShowBeautyDesk(true)');
    expect(sidebar).toContain('Beauty OS');
    expect(store).toContain('showBeautyDesk: boolean');
    expect(store).toContain('setShowBeautyDesk: (show: boolean) => void');
  });

  it('renders the Beauty API flow and answer contract fields', () => {
    const desk = readFileSync(deskPath, 'utf8');

    expect(desk).toContain('window.electronAPI.beauty.getConfig');
    expect(desk).toContain('window.electronAPI.beauty.saveConfig');
    expect(desk).toContain('window.electronAPI.beauty.intentBrief');
    expect(desk).toContain('window.electronAPI.beauty.analystRun');
    expect(desk).toContain('window.electronAPI.beauty.answerResult');
    expect(desk).toContain('window.electronAPI.beauty.savePacket');
    expect(desk).toContain('window.electronAPI.beauty.listPackets');
    expect(desk).toContain('Observed facts');
    expect(desk).toContain('Inference');
    expect(desk).toContain('Citations');
    expect(desk).toContain('Missing data warnings');
    expect(desk).toContain('Confidence');
    expect(desk).toContain('Save packet');
    expect(desk).toContain('Saved reports/history');
  });
});
