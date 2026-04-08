import { describe, expect, it } from 'vitest';
import { buildOpenBrowserCommand } from './session.js';

describe('buildOpenBrowserCommand', () => {
  it('builds a default open command without extra flags', () => {
    expect(buildOpenBrowserCommand('http://localhost:3000')).toBe('open http://localhost:3000');
  });

  it('includes headed mode when headless is disabled', () => {
    expect(buildOpenBrowserCommand('http://localhost:3000', false)).toBe(
      'open http://localhost:3000 --headed',
    );
  });

  it('includes configurable browser flags from ProofShot config', () => {
    expect(
      buildOpenBrowserCommand('https://localhost:3000', true, {
        ignoreHttpsErrors: true,
        executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      }),
    ).toBe(
      'open https://localhost:3000 --ignore-https-errors --executable-path "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"',
    );
  });
});
