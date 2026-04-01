import * as fs from 'fs';
import { describe, it, expect } from 'vitest';
import { createCLI } from './cli.js';

describe('createCLI', () => {
  it('uses the package version', () => {
    const packageJson = JSON.parse(
      fs.readFileSync(new URL('../package.json', import.meta.url), 'utf-8'),
    ) as { version: string };

    expect(createCLI().version()).toBe(packageJson.version);
  });
});
