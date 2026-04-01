import * as fs from 'fs';

declare const __PROOFSHOT_VERSION__: string | undefined;

function readPackageVersion(): string {
  const packageJson = new URL('../package.json', import.meta.url);
  const contents = fs.readFileSync(packageJson, 'utf-8');
  const parsed = JSON.parse(contents) as { version?: string };

  if (!parsed.version) {
    throw new Error('package.json is missing a version field');
  }

  return parsed.version;
}

export const PROOFSHOT_VERSION =
  typeof __PROOFSHOT_VERSION__ !== 'undefined'
    ? __PROOFSHOT_VERSION__
    : readPackageVersion();
