#!/usr/bin/env node

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath, pathToFileURL } from 'node:url';
import WebSocket from 'ws';

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 4173;
const DEFAULT_OUTPUT_DIR = path.join(process.cwd(), 'release', 'smoke', 'beauty-ui');
const CHROME_DEVTOOLS_PATTERN = /DevTools listening on (ws:\/\/[^\s]+)/;
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 1000, mobile: false },
  { name: 'mobile', width: 390, height: 844, mobile: true },
];

export function resolveChromeExecutable({
  env = process.env,
  platform = process.platform,
  exists = fs.existsSync,
} = {}) {
  const candidates = [];

  if (env.CHROME_BIN?.trim()) {
    candidates.push(env.CHROME_BIN.trim());
  }

  if (platform === 'darwin') {
    candidates.push(
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      path.join(os.homedir(), 'Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
    );
  } else if (platform === 'win32') {
    const programFiles = [env.PROGRAMFILES, env['PROGRAMFILES(X86)'], env.LOCALAPPDATA].filter(
      Boolean
    );
    for (const base of programFiles) {
      candidates.push(
        path.join(base, 'Google/Chrome/Application/chrome.exe'),
        path.join(base, 'Chromium/Application/chrome.exe')
      );
    }
  } else {
    candidates.push('/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser');
  }

  const chrome = candidates.find((candidate) => exists(candidate));
  if (!chrome) {
    throw new Error(
      [
        'Chrome executable was not found for Beauty UI smoke.',
        'Set CHROME_BIN to a Chrome/Chromium executable and retry.',
        'Checked candidates:',
        ...candidates.map((candidate) => `- ${candidate}`),
      ].join('\n')
    );
  }
  return chrome;
}

export function assertBeautyUiSnapshot(snapshot) {
  const {
    name,
    width,
    height,
    title,
    bodyText,
    scrollWidth,
    innerWidth,
    screenshot,
  } = snapshot;

  if (title !== 'EveOS Beauty') {
    throw new Error(`[beauty-ui:${name}] Expected document title to be EveOS Beauty, got ${title}`);
  }
  if (!bodyText.includes('Beauty OS command desk')) {
    throw new Error(`[beauty-ui:${name}] Beauty OS command desk was not visible`);
  }
  if (!bodyText.includes('Evidence packet browser')) {
    throw new Error(`[beauty-ui:${name}] Evidence packet browser was not visible`);
  }
  if (!bodyText.includes('Team access')) {
    throw new Error(`[beauty-ui:${name}] Team access panel was not visible`);
  }
  if (bodyText.includes('Open Cowork: Your Personal AI Agent Desktop App')) {
    throw new Error(`[beauty-ui:${name}] Upstream Open Cowork welcome copy was visible`);
  }
  if (scrollWidth > innerWidth + 1) {
    throw new Error(
      `[beauty-ui:${name}] Horizontal overflow detected: scrollWidth=${scrollWidth}, innerWidth=${innerWidth}`
    );
  }
  if (screenshot.width !== width || screenshot.height !== height) {
    throw new Error(
      `[beauty-ui:${name}] Screenshot dimensions ${screenshot.width}x${screenshot.height} did not match requested ${width}x${height}`
    );
  }
  if (!screenshot.nonBlank) {
    throw new Error(
      `[beauty-ui:${name}] Screenshot looked blank: uniqueColors=${screenshot.uniqueColors}`
    );
  }
}

export function analyzePngBuffer(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < PNG_SIGNATURE.length) {
    throw new Error('PNG buffer is empty or invalid');
  }
  if (!buffer.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
    throw new Error('PNG signature is invalid');
  }

  let offset = PNG_SIGNATURE.length;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idatChunks = [];

  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (dataEnd + 4 > buffer.length) {
      throw new Error(`PNG chunk ${type} exceeds buffer length`);
    }
    const data = buffer.subarray(dataStart, dataEnd);

    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === 'IDAT') {
      idatChunks.push(data);
    } else if (type === 'IEND') {
      break;
    }

    offset = dataEnd + 4;
  }

  if (!width || !height || bitDepth !== 8) {
    throw new Error(`Unsupported PNG metadata width=${width} height=${height} bitDepth=${bitDepth}`);
  }

  const channels = channelsForColorType(colorType);
  const bytesPerPixel = channels;
  const rowBytes = width * channels;
  const inflated = zlib.inflateSync(Buffer.concat(idatChunks));
  const uniqueColors = new Set();
  let previous = Buffer.alloc(rowBytes);
  let cursor = 0;

  for (let y = 0; y < height; y += 1) {
    const filter = inflated[cursor];
    cursor += 1;
    const raw = Buffer.from(inflated.subarray(cursor, cursor + rowBytes));
    cursor += rowBytes;
    const row = unfilterPngRow(raw, previous, filter, bytesPerPixel);

    for (let x = 0; x < width; x += 1) {
      const color = [];
      const pixelOffset = x * channels;
      for (let i = 0; i < channels; i += 1) {
        color.push(row[pixelOffset + i]);
      }
      uniqueColors.add(color.join(','));
      if (uniqueColors.size > 1) {
        return {
          width,
          height,
          uniqueColors: uniqueColors.size,
          nonBlank: true,
        };
      }
    }

    previous = row;
  }

  return {
    width,
    height,
    uniqueColors: uniqueColors.size,
    nonBlank: uniqueColors.size > 1,
  };
}

function channelsForColorType(colorType) {
  if (colorType === 0) return 1;
  if (colorType === 2) return 3;
  if (colorType === 6) return 4;
  throw new Error(`Unsupported PNG color type: ${colorType}`);
}

function unfilterPngRow(raw, previous, filter, bytesPerPixel) {
  const row = Buffer.alloc(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    const left = i >= bytesPerPixel ? row[i - bytesPerPixel] : 0;
    const up = previous[i] || 0;
    const upLeft = i >= bytesPerPixel ? previous[i - bytesPerPixel] || 0 : 0;
    let value;

    if (filter === 0) {
      value = raw[i];
    } else if (filter === 1) {
      value = raw[i] + left;
    } else if (filter === 2) {
      value = raw[i] + up;
    } else if (filter === 3) {
      value = raw[i] + Math.floor((left + up) / 2);
    } else if (filter === 4) {
      value = raw[i] + paethPredictor(left, up, upLeft);
    } else {
      throw new Error(`Unsupported PNG row filter: ${filter}`);
    }

    row[i] = value & 0xff;
  }
  return row;
}

function paethPredictor(left, up, upLeft) {
  const p = left + up - upLeft;
  const pa = Math.abs(p - left);
  const pb = Math.abs(p - up);
  const pc = Math.abs(p - upLeft);
  if (pa <= pb && pa <= pc) return left;
  if (pb <= pc) return up;
  return upLeft;
}

export async function runBeautyUiSmoke({
  root = process.cwd(),
  url = process.env.EVEOS_BEAUTY_UI_URL || '',
  host = DEFAULT_HOST,
  port = Number(process.env.EVEOS_BEAUTY_UI_PORT || DEFAULT_PORT),
  outputDir = DEFAULT_OUTPUT_DIR,
  chromePath,
  checkViewport = checkBeautyViewport,
  logger = console.log,
  spawnFn = spawn,
  fetchFn = fetch,
} = {}) {
  let previewProcess = null;
  const targetUrl = url || `http://${host}:${port}/`;

  try {
    if (!url) {
      previewProcess = await startVitePreview({ root, host, port, spawnFn, fetchFn, logger });
    }

    const resolvedChrome = chromePath || resolveChromeExecutable();
    fs.mkdirSync(outputDir, { recursive: true });
    const results = [];
    for (const viewport of VIEWPORTS) {
      results.push(
        await checkViewport({
          url: targetUrl,
          viewport,
          chromePath: resolvedChrome,
          outputDir,
          logger,
          spawnFn,
        })
      );
    }

    logger(`[beauty-ui] Visual smoke passed for ${results.map((item) => item.name).join(', ')}`);
    return { ok: true, url: targetUrl, results };
  } finally {
    if (previewProcess) {
      previewProcess.kill();
    }
  }
}

async function startVitePreview({ root, host, port, spawnFn, fetchFn, logger }) {
  const viteBin = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js');
  if (!fs.existsSync(viteBin)) {
    throw new Error(`Vite binary was not found: ${viteBin}`);
  }

  const child = spawnFn(
    process.execPath,
    [viteBin, 'preview', '--host', host, '--port', String(port), '--strictPort'],
    {
      cwd: root,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, BROWSER: 'none' },
    }
  );

  child.stdout?.on('data', (chunk) => logger(`[beauty-ui:preview] ${String(chunk).trim()}`));
  child.stderr?.on('data', (chunk) => logger(`[beauty-ui:preview] ${String(chunk).trim()}`));
  await waitForHttp(`http://${host}:${port}/`, fetchFn, 15000);
  return child;
}

async function waitForHttp(url, fetchFn, timeoutMs) {
  const startedAt = Date.now();
  let lastError = null;
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetchFn(url);
      if (response.ok) return;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await delay(250);
  }
  throw new Error(`Timed out waiting for ${url}: ${lastError?.message || lastError}`);
}

async function checkBeautyViewport({ url, viewport, chromePath, outputDir, logger, spawnFn }) {
  const chrome = await launchChromeForCdp({ chromePath, spawnFn, logger });
  try {
    const screenshotPath = path.join(outputDir, `beauty-ui-${viewport.name}.png`);
    const snapshot = await captureBeautySnapshot({ browserWsUrl: chrome.browserWsUrl, url, viewport });
    fs.writeFileSync(screenshotPath, Buffer.from(snapshot.screenshotBase64, 'base64'));
    const screenshot = analyzePngBuffer(fs.readFileSync(screenshotPath));
    const completeSnapshot = {
      ...snapshot.metrics,
      name: viewport.name,
      width: viewport.width,
      height: viewport.height,
      screenshot,
    };
    assertBeautyUiSnapshot(completeSnapshot);
    logger(`[beauty-ui] ${viewport.name} screenshot=${screenshotPath}`);
    return {
      ok: true,
      name: viewport.name,
      screenshotPath,
      metrics: completeSnapshot,
    };
  } finally {
    await chrome.close();
  }
}

async function launchChromeForCdp({ chromePath, spawnFn, logger }) {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eveos-beauty-chrome-'));
  let stderr = '';
  const child = spawnFn(
    chromePath,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      '--remote-debugging-port=0',
      `--user-data-dir=${userDataDir}`,
      'about:blank',
    ],
    { stdio: ['ignore', 'ignore', 'pipe'] }
  );

  const browserWsUrl = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Timed out waiting for Chrome DevTools URL. stderr=${stderr.trim()}`));
    }, 15000);

    child.once('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.stderr?.on('data', (chunk) => {
      stderr += String(chunk);
      const match = stderr.match(CHROME_DEVTOOLS_PATTERN);
      if (match) {
        clearTimeout(timeout);
        resolve(match[1]);
      }
    });
    child.once('exit', (code, signal) => {
      clearTimeout(timeout);
      reject(new Error(`Chrome exited before DevTools was ready: code=${code} signal=${signal}`));
    });
  });

  return {
    browserWsUrl,
    async close() {
      if (child.exitCode === null && child.signalCode === null) {
        child.kill();
        await waitForProcessExit(child, 3000);
      }
      fs.rmSync(userDataDir, { recursive: true, force: true });
      logger(`[beauty-ui] Chrome closed`);
    },
  };
}

function waitForProcessExit(child, timeoutMs) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const timeout = setTimeout(resolve, timeoutMs);
    child.once('exit', () => {
      clearTimeout(timeout);
      resolve();
    });
  });
}

async function captureBeautySnapshot({ browserWsUrl, url, viewport }) {
  const client = await CdpClient.connect(browserWsUrl);
  try {
    const { targetId } = await client.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await client.send('Target.attachToTarget', {
      targetId,
      flatten: true,
    });

    await client.send('Page.enable', {}, sessionId);
    await client.send('Runtime.enable', {}, sessionId);
    await client.send(
      'Emulation.setDeviceMetricsOverride',
      {
        width: viewport.width,
        height: viewport.height,
        deviceScaleFactor: 1,
        mobile: viewport.mobile,
      },
      sessionId
    );

    const loaded = client.waitForEvent(
      'Page.loadEventFired',
      (event) => event.sessionId === sessionId,
      15000
    );
    await client.send('Page.navigate', { url }, sessionId);
    await loaded;
    await client.send(
      'Runtime.evaluate',
      {
        expression: 'new Promise((resolve) => setTimeout(resolve, 750))',
        awaitPromise: true,
      },
      sessionId
    );

    const { result } = await client.send(
      'Runtime.evaluate',
      {
        expression: `({
          title: document.title,
          bodyText: document.body?.innerText || '',
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth: window.innerWidth
        })`,
        returnByValue: true,
      },
      sessionId
    );
    const screenshot = await client.send('Page.captureScreenshot', { format: 'png' }, sessionId);

    await client.send('Target.closeTarget', { targetId });
    return {
      metrics: result.value,
      screenshotBase64: screenshot.data,
    };
  } finally {
    client.close();
  }
}

class CdpClient {
  static async connect(url) {
    const ws = new WebSocket(url);
    const client = new CdpClient(ws);
    await new Promise((resolve, reject) => {
      ws.once('open', resolve);
      ws.once('error', reject);
    });
    return client;
  }

  constructor(ws) {
    this.ws = ws;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = [];
    ws.on('message', (message) => this.handleMessage(message));
  }

  send(method, params = {}, sessionId) {
    const id = this.nextId;
    this.nextId += 1;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    this.ws.send(JSON.stringify(payload));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
  }

  waitForEvent(method, predicate, timeoutMs) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.listeners = this.listeners.filter((listener) => listener.resolve !== resolve);
        reject(new Error(`Timed out waiting for CDP event ${method}`));
      }, timeoutMs);
      this.listeners.push({ method, predicate, resolve, timeout });
    });
  }

  handleMessage(message) {
    const parsed = JSON.parse(String(message));
    if (parsed.id && this.pending.has(parsed.id)) {
      const pending = this.pending.get(parsed.id);
      this.pending.delete(parsed.id);
      if (parsed.error) {
        pending.reject(new Error(parsed.error.message || JSON.stringify(parsed.error)));
      } else {
        pending.resolve(parsed.result || {});
      }
      return;
    }

    for (const listener of [...this.listeners]) {
      if (parsed.method === listener.method && listener.predicate(parsed)) {
        clearTimeout(listener.timeout);
        this.listeners = this.listeners.filter((item) => item !== listener);
        listener.resolve(parsed);
      }
    }
  }

  close() {
    this.ws.close();
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const currentFile = fileURLToPath(import.meta.url);

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  runBeautyUiSmoke().catch((error) => {
    console.error(`[beauty-ui] FAILED: ${error instanceof Error ? error.message : error}`);
    process.exitCode = 1;
  });
}

export const __filename = currentFile;
