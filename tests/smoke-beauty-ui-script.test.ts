import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

async function loadBeautyUiSmokeModule() {
  return await import('../scripts/smoke-beauty-ui.mjs');
}

function pngChunk(type: string, payload: Buffer): Buffer {
  const header = Buffer.alloc(8);
  header.writeUInt32BE(payload.length, 0);
  header.write(type, 4, 'ascii');
  return Buffer.concat([header, payload, Buffer.alloc(4)]);
}

function makeRgbaPng(width: number, height: number, pixels: number[][]): Buffer {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const rows: Buffer[] = [];
  for (let y = 0; y < height; y += 1) {
    const row = Buffer.alloc(1 + width * 4);
    row[0] = 0;
    for (let x = 0; x < width; x += 1) {
      const [r, g, b, a] = pixels[y * width + x];
      const offset = 1 + x * 4;
      row[offset] = r;
      row[offset + 1] = g;
      row[offset + 2] = b;
      row[offset + 3] = a;
    }
    rows.push(row);
  }

  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(Buffer.concat(rows))),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

describe('Beauty UI visual smoke script', () => {
  it('is exposed as an npm smoke command', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));

    expect(pkg.scripts['smoke:beauty-ui']).toBe('vite build && node scripts/smoke-beauty-ui.mjs');
  });

  it('resolves Chrome from an explicit environment override', async () => {
    const { resolveChromeExecutable } = await loadBeautyUiSmokeModule();

    expect(
      resolveChromeExecutable({
        env: { CHROME_BIN: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' },
        exists: (candidate: string) =>
          candidate === '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      })
    ).toBe('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
  });

  it('rejects missing required Beauty OS DOM signals', async () => {
    const { assertBeautyUiSnapshot } = await loadBeautyUiSmokeModule();

    expect(() =>
      assertBeautyUiSnapshot({
        name: 'desktop',
        width: 1440,
        height: 1000,
        title: 'Open Cowork',
        bodyText: 'Welcome',
        scrollWidth: 1440,
        innerWidth: 1440,
        screenshot: {
          width: 1440,
          height: 1000,
          uniqueColors: 12,
          nonBlank: true,
        },
      })
    ).toThrow('Expected document title to be EveOS Beauty');
  });

  it('accepts Beauty OS DOM signals and nonblank screenshots without overflow', async () => {
    const { assertBeautyUiSnapshot } = await loadBeautyUiSmokeModule();

    expect(() =>
      assertBeautyUiSnapshot({
        name: 'mobile',
        width: 390,
        height: 844,
        title: 'EveOS Beauty',
        bodyText: 'Beauty OS command desk Evidence packet browser Team access',
        scrollWidth: 390,
        innerWidth: 390,
        screenshot: {
          width: 390,
          height: 844,
          uniqueColors: 12,
          nonBlank: true,
        },
      })
    ).not.toThrow();
  });

  it('detects blank and nonblank PNG screenshots', async () => {
    const { analyzePngBuffer } = await loadBeautyUiSmokeModule();
    const blank = makeRgbaPng(2, 1, [
      [255, 255, 255, 255],
      [255, 255, 255, 255],
    ]);
    const nonblank = makeRgbaPng(2, 1, [
      [255, 255, 255, 255],
      [210, 113, 122, 255],
    ]);

    expect(analyzePngBuffer(blank)).toMatchObject({
      width: 2,
      height: 1,
      uniqueColors: 1,
      nonBlank: false,
    });
    expect(analyzePngBuffer(nonblank)).toMatchObject({
      width: 2,
      height: 1,
      uniqueColors: 2,
      nonBlank: true,
    });
  });

  it('runs both desktop and mobile checks against an existing URL', async () => {
    const { runBeautyUiSmoke } = await loadBeautyUiSmokeModule();
    const checkViewport = vi
      .fn()
      .mockResolvedValueOnce({ name: 'desktop', ok: true })
      .mockResolvedValueOnce({ name: 'mobile', ok: true });

    await expect(
      runBeautyUiSmoke({
        url: 'http://127.0.0.1:4173/',
        chromePath: '/fake/chrome',
        checkViewport,
        logger: vi.fn(),
      })
    ).resolves.toMatchObject({
      ok: true,
      url: 'http://127.0.0.1:4173/',
      results: [
        { name: 'desktop', ok: true },
        { name: 'mobile', ok: true },
      ],
    });
    expect(checkViewport).toHaveBeenCalledTimes(2);
  });
});
