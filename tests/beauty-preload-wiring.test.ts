import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const preloadPath = path.join(root, 'src/preload/index.ts');
const ipcTypesPath = path.join(root, 'src/shared/ipc-types.ts');

describe('Beauty preload export wiring', () => {
  it('exposes a typed packet export bridge without exposing local file writes to renderer code', () => {
    const preload = readFileSync(preloadPath, 'utf8');
    const ipcTypes = readFileSync(ipcTypesPath, 'utf8');

    expect(ipcTypes).toContain('BeautyPacketExportInput');
    expect(ipcTypes).toContain('BeautyPacketExportResult');
    expect(preload).toContain('BeautyPacketExportInput');
    expect(preload).toContain('BeautyPacketExportResult');
    expect(preload).toContain('exportPacket: (input: BeautyPacketExportInput)');
    expect(preload).toContain("ipcRenderer.invoke('beauty.exportPacket', input)");
    expect(preload).not.toContain('writeFileSync');
  });
});
