import { ab, ProofShotError } from '../utils/exec.js';
import {
  DEFAULT_BROWSER_OPEN_TIMEOUT_MS,
  type BrowserConfig,
  type TimeoutConfig,
  type ViewportConfig,
} from '../utils/config.js';

export function buildOpenBrowserCommand(
  url: string,
  headless = true,
  browserConfig?: BrowserConfig,
): string {
  const flags: string[] = [];

  if (!headless) flags.push('--headed');
  if (browserConfig?.ignoreHttpsErrors) flags.push('--ignore-https-errors');
  if (browserConfig?.executablePath) {
    flags.push(`--executable-path "${browserConfig.executablePath.replace(/"/g, '\\"')}"`);
  }

  const suffix = flags.length > 0 ? ` ${flags.join(' ')}` : '';
  return `open ${url}${suffix}`;
}

export function buildSetViewportCommand(viewport: ViewportConfig): string {
  const parts = ['set', 'viewport', String(viewport.width), String(viewport.height)];
  if (viewport.deviceScaleFactor !== undefined) {
    parts.push(String(viewport.deviceScaleFactor));
  }
  return parts.join(' ');
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
  timeouts?: TimeoutConfig,
): void {
  ab(buildOpenBrowserCommand(url, headless, browserConfig), {
    timeoutMs: timeouts?.browserOpenMs ?? DEFAULT_BROWSER_OPEN_TIMEOUT_MS,
    session: sessionName,
  });
  applyViewport(viewport, sessionName);
}

/**
 * Apply the configured browser viewport to the active session.
 */
export function applyViewport(viewport: ViewportConfig, sessionName?: string): void {
  ab(buildSetViewportCommand(viewport), { session: sessionName });
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
  timestamp: number;
  type: string;
}

/**
 * Get console output as structured JSON with per-message timestamps.
 */
export function getConsoleOutputJson(sessionName?: string): ConsoleMessage[] {
  try {
    const raw = ab('console --json', { session: sessionName });
    const parsed = JSON.parse(raw);
    const messages = parsed?.data?.messages ?? parsed;
    return Array.isArray(messages) ? messages : [];
  } catch {
    return [];
  }
}

export function getPageTitle(sessionName?: string): string {
  try {
    return ab('get title', { session: sessionName });
  } catch {
    return '';
  }
}

export function getPageUrl(sessionName?: string): string {
  try {
    return ab('get url', { session: sessionName });
  } catch {
    return '';
  }
}

export function getViewport(sessionName?: string): ViewportConfig | null {
  try {
    const raw = ab("eval 'JSON.stringify({width: window.innerWidth, height: window.innerHeight})'", {
      session: sessionName,
    });
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

export function verifyBrowserState(
  expectedUrl: string,
  expectedViewport: ViewportConfig,
  sessionName?: string,
): BrowserState {
  const url = getPageUrl(sessionName);
  const viewport = getViewport(sessionName);

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
