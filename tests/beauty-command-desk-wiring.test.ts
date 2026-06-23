import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const appPath = path.join(root, 'src/renderer/App.tsx');
const sidebarPath = path.join(root, 'src/renderer/components/Sidebar.tsx');
const storePath = path.join(root, 'src/renderer/store/index.ts');
const deskPath = path.join(root, 'src/renderer/components/beauty/BeautyCommandDesk.tsx');
const globalsPath = path.join(root, 'src/renderer/styles/globals.css');

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
    expect(desk).toContain('window.electronAPI.beauty.analystQueue');
    expect(desk).toContain('window.electronAPI.beauty.answerResult');
    expect(desk).toContain('window.electronAPI.beauty.savePacket');
    expect(desk).toContain('window.electronAPI.beauty.listPackets');
    expect(desk).toContain('window.electronAPI.beauty.exportPacket');
    expect(desk).toContain('Observed facts');
    expect(desk).toContain('Inference');
    expect(desk).toContain('Citations');
    expect(desk).toContain('Missing data warnings');
    expect(desk).toContain('Confidence');
    expect(desk).toContain('Evidence packet browser');
    expect(desk).toContain('EvidenceSourcePanel');
    expect(desk).toContain('summarizeBeautyEvidence');
    expect(desk).toContain('sourceTable');
    expect(desk).toContain('artifactPath');
    expect(desk).toContain('missingSourceWarning');
    expect(desk).toContain('Save packet');
    expect(desk).toContain('Export packet');
    expect(desk).toContain('Saved reports/history');
    expect(desk).toContain('Analyst queue mission control');
    expect(desk).toContain('Refresh queue');
    expect(desk).toContain('QueueSnapshotPanel');
    expect(desk).toContain('summarizeBeautyQueueSnapshot');
    expect(desk).toContain('Team access');
    expect(desk).toContain('Cloudflare Access');
    expect(desk).toContain('Bearer token stays in Electron main');
    expect(desk).toContain('Sparkles');
    expect(desk).toContain('ShieldCheck');
    expect(desk).toContain('RefreshCw');
    expect(desk).toContain('Download');
  });

  it('uses mobile-safe Beauty layout classes and visible disabled button styling', () => {
    const desk = readFileSync(deskPath, 'utf8');
    const globals = readFileSync(globalsPath, 'utf8');

    expect(desk).toContain('grid grid-cols-1 gap-2 sm:grid-cols-2');
    expect(desk).toContain('flex flex-col gap-2 border-t border-border-muted pt-3 sm:flex-row');
    expect(globals).toContain('disabled:cursor-not-allowed');
    expect(globals).toContain('disabled:opacity-40');
  });
});
