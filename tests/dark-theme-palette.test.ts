import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const stylesPath = path.resolve(process.cwd(), 'src/renderer/styles/globals.css');

describe('dark theme palette', () => {
  it('uses an EveOS Beauty graphite palette for the default theme', () => {
    const source = fs.readFileSync(stylesPath, 'utf8');
    expect(source).toContain('--color-background: #171416;');
    expect(source).toContain('--color-surface: #231e22;');
    expect(source).toContain('--color-text-primary: #f6eee9;');
  });

  it('keeps the accent within the BANILA rose family', () => {
    const source = fs.readFileSync(stylesPath, 'utf8');
    expect(source).toContain('--color-accent: #d4717a;');
    expect(source).toContain('--color-accent-hover: #b94e58;');
    expect(source).toContain('--color-accent-control: #b94e58;');
    expect(source).toContain('--color-accent-control-hover: #a33f4a;');
  });
});
