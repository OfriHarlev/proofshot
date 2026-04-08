import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';

describe('loadConfig', () => {
  it('merges nested browser config with defaults', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'proofshot-config-test-'));
    fs.writeFileSync(
      path.join(tempDir, 'proofshot.config.json'),
      JSON.stringify({
        browser: {
          executablePath: '/tmp/chrome',
        },
      }),
    );

    expect(loadConfig(tempDir).browser).toEqual({
      executablePath: '/tmp/chrome',
      ignoreHttpsErrors: false,
    });
  });

  it('merges viewport device scale factor with defaults', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'proofshot-viewport-config-'));
    fs.writeFileSync(
      path.join(tempDir, 'proofshot.config.json'),
      JSON.stringify({
        viewport: {
          width: 1920,
          height: 1080,
          deviceScaleFactor: 1,
        },
      }),
    );

    expect(loadConfig(tempDir).viewport).toEqual({
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1,
    });
  });
});
