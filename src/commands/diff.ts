import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { loadConfig } from '../utils/config.js';
import { diffScreenshots } from '../browser/capture.js';

interface DiffOptions {
  baseline: string;
}

export async function diffCommand(options: DiffOptions): Promise<void> {
  const config = loadConfig();
  const currentDir = path.resolve(config.output);
  const baselineDir = path.resolve(options.baseline);

  if (!fs.existsSync(baselineDir)) {
    console.error(chalk.red('✗') + ` Baseline directory not found: ${baselineDir}`);
    process.exit(1);
  }

  if (!fs.existsSync(currentDir)) {
    console.error(
      chalk.red('✗') +
        ` Current artifacts not found: ${currentDir}\n` +
        chalk.dim('Run "proofshot verify" first to generate screenshots.'),
    );
    process.exit(1);
  }

  // Find matching screenshot pairs
  const baselineFiles = fs.readdirSync(baselineDir).filter((f) => f.startsWith('page-') && f.endsWith('.png'));
  const currentFiles = fs.readdirSync(currentDir).filter((f) => f.startsWith('page-') && f.endsWith('.png'));

  if (baselineFiles.length === 0) {
    console.error(chalk.red('✗') + ' No baseline screenshots found (looking for page-*.png)');
    process.exit(1);
  }

  const diffDir = path.join(currentDir, 'diffs');
  fs.mkdirSync(diffDir, { recursive: true });

  console.log(chalk.dim('Comparing screenshots...\n'));

  let hasChanges = false;

  for (const file of baselineFiles) {
    const baselinePath = path.join(baselineDir, file);
    const currentPath = path.join(currentDir, file);
    const diffPath = path.join(diffDir, `diff-${file}`);

    if (!fs.existsSync(currentPath)) {
      console.log(chalk.yellow('⚠') + ` ${file}: no matching current screenshot (page removed?)`);
      continue;
    }

    const mismatch = diffScreenshots(baselinePath, currentPath, diffPath);

    if (mismatch === null) {
      console.log(chalk.yellow('⚠') + ` ${file}: could not compare`);
    } else if (mismatch === 0) {
      console.log(chalk.green('✓') + ` ${file}: identical`);
    } else {
      hasChanges = true;
      console.log(
        chalk.red('✗') +
          ` ${file}: ${chalk.bold(`${mismatch.toFixed(2)}%`)} changed → ${chalk.dim(diffPath)}`,
      );
    }
  }

  // Check for new pages
  for (const file of currentFiles) {
    if (!baselineFiles.includes(file)) {
      console.log(chalk.cyan('+') + ` ${file}: new page (no baseline)`);
      hasChanges = true;
    }
  }

  console.log('');
  if (hasChanges) {
    console.log(chalk.yellow('Visual changes detected.') + ` Diff images saved to ${chalk.dim(diffDir)}`);
  } else {
    console.log(chalk.green('No visual changes detected.'));
  }
}
