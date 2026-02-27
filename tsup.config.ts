import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: { 'bin/proofshot': 'bin/proofshot.ts' },
    format: ['esm'],
    target: 'node18',
    platform: 'node',
    sourcemap: true,
    clean: true,
    shims: true,
    banner: {
      js: '#!/usr/bin/env node',
    },
  },
  {
    entry: { 'src/index': 'src/index.ts' },
    format: ['esm'],
    target: 'node18',
    platform: 'node',
    splitting: true,
    sourcemap: true,
    dts: true,
    shims: true,
  },
]);
