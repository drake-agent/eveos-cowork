import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const tailwindConfigPath = path.join(process.cwd(), 'tailwind.config.js');

describe('Tailwind content blocklist', () => {
  it('blocks bracketed cwd examples from being treated as arbitrary classes', () => {
    const source = fs.readFileSync(tailwindConfigPath, 'utf8');

    expect(source).toContain("blocklist: ['[-:_.]', '[cwd:path]', '[cwd:路径]']");
  });
});
