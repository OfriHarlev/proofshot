import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { loadConfig } from '../utils/config.js';
import { type VerificationResult, type PageResult, countErrors, countWarnings } from '../artifacts/bundle.js';
import { formatForPR } from '../artifacts/pr-format.js';

export async function prCommand(): Promise<void> {
  const config = loadConfig();
  const outputDir = path.resolve(config.output);
  const summaryPath = path.join(outputDir, 'SUMMARY.md');

  if (!fs.existsSync(summaryPath)) {
    console.error(
      chalk.red('✗') +
        ' No verification results found.\n' +
        chalk.dim('Run "proofshot verify" first.'),
    );
    process.exit(1);
  }

  // Reconstruct a minimal VerificationResult from the artifacts on disk
  const screenshots = fs
    .readdirSync(outputDir)
    .filter((f) => f.startsWith('page-') && f.endsWith('.png'));

  const videos = fs
    .readdirSync(outputDir)
    .filter((f) => f.startsWith('session-') && f.endsWith('.webm'));

  const pageResults: PageResult[] = screenshots.map((f) => {
    const pageName = f.replace(/^page-/, '').replace(/\.png$/, '');
    const page = pageName === 'home' ? '/' : `/${pageName.replace(/-/g, '/')}`;
    return {
      page,
      title: '',
      url: '',
      screenshotPath: path.join(outputDir, f),
      snapshot: '',
      errors: '',
      consoleOutput: '',
    };
  });

  const result: VerificationResult = {
    pageResults,
    videoPath: videos.length > 0 ? path.join(outputDir, videos[0]) : null,
    outputDir,
    timestamp: '',
    framework: 'Unknown',
    port: config.devServer.port,
    serverAlreadyRunning: true,
    durationMs: 0,
  };

  const output = formatForPR(result);
  // Write to stdout so it can be piped
  process.stdout.write(output);
}
