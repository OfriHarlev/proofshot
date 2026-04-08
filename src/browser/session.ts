import { ab, ProofShotError } from '../utils/exec.js';
import type { BrowserConfig, ViewportConfig } from '../utils/config.js';

export function buildOpenBrowserCommand(
  url: string,
  headless = true,
  browserConfig?: BrowserConfig,
): string {
  const flags: string[] = [];

  if (!headless) flags.push('--headed');
  if (browserConfig?.ignoreHttpsErrors) flags.push('--ignore-https-errors');
  if (browserConfig?.executablePath) flags.push(`--executable-path "${browserConfig.executablePath.replace(/"/g, '\\"')}"`);

  const suffix = flags.length > 0 ? ` ${flags.join(' ')}` : '';
  return `open ${url}${suffix}`;
}

export interface BrowserState {
  url: string;
  viewport: ViewportConfig | null;
}

/**
 * Initialize a browser session.
 * Opens the browser and sets viewport dimensions.
 */
export function openBrowser(
  url: string,
  viewport: ViewportConfig,
  headless = true,
  sessionName?: string,
  browserConfig?: BrowserConfig,
): void {
  ab(buildOpenBrowserCommand(url, headless, browserConfig), { timeoutMs: 60000, session: sessionName });
  ab(`set viewport ${viewport.width} ${viewport.height}`, { session: sessionName });
}

/**
 * Close the browser session.
 */
export function closeBrowser(sessionName?: string): void {
  try {
    ab('close', { session: sessionName });
  } catch {
    // Browser may already be closed — that's fine
  }
}

/**
 * Check if agent-browser is installed and accessible.
 */
export function checkAgentBrowser(): boolean {
  try {
    ab('--version', 5000);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get any console errors from the current page.
 */
export function getConsoleErrors(sessionName?: string): string {
  try {
    return ab('errors', { session: sessionName });
  } catch {
    return '';
  }
}

/**
 * Get console output from the current page.
 */
export function getConsoleOutput(sessionName?: string): string {
  try {
    return ab('console', { session: sessionName });
  } catch {
    return '';
  }
}

export interface ConsoleMessage {
  text: string;
  timestamp: number; // epoch ms
  type: string; // log, warn, error, etc.
}

/**
 * Get console output as structured JSON with per-message timestamps.
 */
export function getConsoleOutputJson(sessionName?: string): ConsoleMessage[] {
  try {
    const raw = ab('console --json', { session: sessionName });
    const parsed = JSON.parse(raw);
    // agent-browser wraps JSON output: {success, data: {messages: [...]}, error}
    const messages = parsed?.data?.messages ?? parsed;
    return Array.isArray(messages) ? messages : [];
  } catch {
    return [];
  }
}

/**
 * Get the current page title.
 */
export function getPageTitle(sessionName?: string): string {
  try {
    return ab('get title', { session: sessionName });
  } catch {
    return '';
  }
}

/**
 * Get the current page URL.
 */
export function getPageUrl(sessionName?: string): string {
  try {
    return ab('get url', { session: sessionName });
  } catch {
    return '';
  }
}

/**
 * Get the current viewport from the page context.
 */
export function getViewport(): ViewportConfig | null {
  try {
    const raw = ab("eval 'JSON.stringify({width: window.innerWidth, height: window.innerHeight})'");
    const parsed = JSON.parse(raw);
    if (
      typeof parsed?.width === 'number' &&
      Number.isFinite(parsed.width) &&
      typeof parsed?.height === 'number' &&
      Number.isFinite(parsed.height)
    ) {
      return { width: parsed.width, height: parsed.height };
    }
    return null;
  } catch {
    return null;
  }
}

function normalizeUrlForComparison(value: string): string {
  try {
    const url = new URL(value);
    const pathname = url.pathname !== '/' ? url.pathname.replace(/\/+$/, '') : '/';
    return `${url.origin}${pathname}${url.search}`;
  } catch {
    return value.trim();
  }
}

export function urlsMatch(expectedUrl: string, actualUrl: string): boolean {
  return normalizeUrlForComparison(expectedUrl) === normalizeUrlForComparison(actualUrl);
}

/**
 * Read current browser state and fail if it doesn't match the expected URL/viewport.
 */
export function verifyBrowserState(
  expectedUrl: string,
  expectedViewport: ViewportConfig,
): BrowserState {
  const url = getPageUrl();
  const viewport = getViewport();

  if (!url) {
    throw new ProofShotError(
      'Could not read the current browser URL after recording started. The browser session may not be attached correctly.',
    );
  }

  if (!urlsMatch(expectedUrl, url)) {
    throw new ProofShotError(
      `Browser navigated to ${url}, expected ${expectedUrl}. Recording may be attached to the wrong page or session.`,
    );
  }

  if (!viewport) {
    throw new ProofShotError(
      'Could not read the current viewport after recording started. The browser session may not be attached correctly.',
    );
  }

  if (viewport.width !== expectedViewport.width || viewport.height !== expectedViewport.height) {
    throw new ProofShotError(
      `Browser viewport is ${viewport.width}x${viewport.height}, expected ${expectedViewport.width}x${expectedViewport.height}. Recording may be attached to the wrong page or session.`,
    );
  }

  return { url, viewport };
}
