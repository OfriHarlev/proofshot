import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { loadConfig } from '../utils/config.js';

export async function cleanCommand(): Promise<void> {
  const config = loadConfig();
  const outputDir = path.resolve(config.output);

  if (!fs.existsSync(outputDir)) {
    console.log(chalk.dim('Nothing to clean — no artifacts directory found.'));
    return;
  }

  fs.rmSync(outputDir, { recursive: true, force: true });
  console.log(chalk.green('✓') + ` Removed ${chalk.dim(outputDir)}`);
}
