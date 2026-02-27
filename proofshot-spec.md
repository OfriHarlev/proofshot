# ProofShot — Visual Verification for AI Coding Agents

## Product Spec v1.0

**One-liner:** Give any AI coding agent eyes. It builds a feature → ProofShot records video proof it works.

**Tagline:** "Cursor charges $200/mo for agents that can see what they build. Here's the same thing, free, for every agent."

---

## 1. What This Is

ProofShot is an open-source CLI tool + skill file that lets any AI coding agent visually verify the features it builds by:

1. Auto-detecting and starting the dev server
2. Opening a headless browser, navigating to the app
3. Clicking through the UI to verify the feature works
4. Recording a video of the entire session
5. Taking annotated screenshots at key moments
6. Generating a markdown summary with all artifacts

It works with: Claude Code, Codex, Cursor, Gemini CLI, GitHub Copilot, Windsurf, Goose, OpenCode — any agent that can run bash commands.

**What makes this different from just using agent-browser directly:**
- Zero-config dev server detection and startup
- Recording is automatic (not manual start/stop)
- Produces a structured artifact bundle (video + screenshots + summary) ready for PR
- Ships with a skill file that teaches any agent HOW to do visual verification — the user doesn't prompt-engineer anything
- One command: `proofshot verify` does everything

---

## 2. Architecture

### Core Dependency

ProofShot wraps **Vercel's `agent-browser`** (not raw Playwright MCP). Reasons:

- 93% less context usage vs Playwright MCP (~200-400 tokens per snapshot vs ~3000-5000)
- Rust CLI + persistent Node.js daemon = fast command execution
- Snapshot + Refs system (@e1, @e2) for deterministic element selection
- Built-in `record start` / `record stop` for video
- Built-in `screenshot --annotate` for labeled screenshots
- Built-in `diff screenshot` for visual regression detection
- Already works headless — no window on user's screen
- Already works with every major AI coding agent

### Tech Stack

```
proofshot (our tool)
├── TypeScript CLI (thin orchestration layer)
├── agent-browser (Vercel's tool — handles all browser work)
│   ├── Rust CLI (fast command parsing)
│   └── Node.js daemon (Playwright under the hood)
├── Dev server detection module
└── Artifact bundler (video + screenshots + markdown summary)
```

### What We Build vs What We Reuse

| Component | Build or Reuse |
|-----------|---------------|
| Browser automation | **Reuse** — agent-browser |
| Video recording | **Reuse** — agent-browser `record start/stop` |
| Screenshots | **Reuse** — agent-browser `screenshot --annotate` |
| Visual diffs | **Reuse** — agent-browser `diff screenshot` |
| Dev server detection | **Build** — detect framework + start command |
| Artifact bundling | **Build** — collect video/screenshots/summary into folder |
| Summary generation | **Build** — markdown report of what was verified |
| Skill file | **Build** — teaches AI agents how to use ProofShot |
| CLI wrapper | **Build** — `proofshot verify` orchestration command |

---

## 3. User Experience

### Installation (30 seconds)

```bash
npm install -g proofshot
```

This also installs `agent-browser` as a dependency and runs `agent-browser install` to download Chromium.

### Setup in a Project (10 seconds)

```bash
cd my-project
proofshot init
```

This does:
1. Detects the framework (Next.js, Vite, Remix, Astro, CRA, etc.)
2. Creates `proofshot.config.json` with detected settings:
   ```json
   {
     "devServer": {
       "command": "npm run dev",
       "port": 3000,
       "waitForText": "ready on",
       "startupTimeout": 30000
     },
     "output": "./proofshot-artifacts",
     "defaultPages": ["/"],
     "viewport": { "width": 1280, "height": 720 },
     "headless": true
   }
   ```
3. Installs the skill file for the detected agent:
   - Claude Code: `.claude/skills/proofshot/SKILL.md`
   - Codex: `codex.md` / `AGENTS.md` append
   - Cursor: `.cursor/rules/proofshot.mdc`
   - General: `PROOFSHOT.md` in project root

### Usage — The Developer Does Nothing Different

The developer codes normally with their AI agent. When a UI feature is done, they just say:

> "Now verify this visually with proofshot"

Or better — the skill file teaches the agent to do it automatically after UI changes. The agent then runs:

```bash
proofshot verify --pages "/dashboard,/settings" --record
```

Or for the simplest case:

```bash
proofshot verify
```

### What Happens Behind the Scenes

```
1. proofshot detects dev server is not running
2. proofshot starts dev server (npm run dev)
3. proofshot waits for server to be ready (detects "ready on" or port open)
4. proofshot calls: agent-browser open http://localhost:3000
5. proofshot calls: agent-browser record start ./proofshot-artifacts/session.webm
6. For each page in --pages:
   a. agent-browser open http://localhost:3000{page}
   b. agent-browser wait --load networkidle
   c. agent-browser screenshot ./proofshot-artifacts/page-{name}.png
   d. agent-browser snapshot -i  (returns to stdout for the agent to read)
7. proofshot calls: agent-browser record stop
8. proofshot generates summary markdown
9. proofshot outputs paths to all artifacts
```

### What the Agent Sees (Output)

```
✅ ProofShot verification complete

📹 Video:       ./proofshot-artifacts/session-2026-02-25.webm (32s)
📸 Screenshots: 3 captured
  - /               → ./proofshot-artifacts/page-home.png
  - /dashboard      → ./proofshot-artifacts/page-dashboard.png
  - /settings       → ./proofshot-artifacts/page-settings.png
📝 Summary:     ./proofshot-artifacts/SUMMARY.md

Dev server: Next.js on :3000
Pages verified: 3
Errors detected: 0
Console warnings: 2
```

### The Summary File (SUMMARY.md)

```markdown
# ProofShot Visual Verification Report

**Date:** 2026-02-25 14:32:00
**Project:** my-saas-app
**Framework:** Next.js
**Dev Server:** localhost:3000

## Pages Verified

### / (Home)
- Status: ✅ Loaded successfully
- Screenshot: ![Home](./page-home.png)
- Interactive elements: 12 buttons, 3 links, 2 forms
- Console errors: 0

### /dashboard
- Status: ✅ Loaded successfully
- Screenshot: ![Dashboard](./page-dashboard.png)
- Interactive elements: 8 buttons, 15 links, 1 form
- Console errors: 0
- Console warnings: 2 (deprecation warnings)

## Video Recording
Full session recording: [session-2026-02-25.webm](./session-2026-02-25.webm)

## Environment
- Browser: Chromium (headless)
- Viewport: 1280x720
- Duration: 32 seconds
```

---

## 4. CLI Commands

### `proofshot init`

Detects framework, creates config, installs skill file.

```bash
proofshot init
# Interactive: detects framework, asks which agent you use
# Flags:
#   --agent claude|codex|cursor|gemini|copilot|generic
#   --force  (overwrite existing config)
```

### `proofshot verify`

Main command. Starts server, opens browser, records, screenshots, generates summary.

```bash
proofshot verify
# Flags:
#   --pages "/,/about,/dashboard"  (comma-separated paths to verify)
#   --record                       (enable video recording, default: true)
#   --no-record                    (skip video, screenshots only)
#   --interact                     (after screenshots, let the calling agent interact via agent-browser)
#   --port 3000                    (override detected port)
#   --no-server                    (don't start dev server, assume it's running)
#   --headed                       (show browser window for debugging)
#   --output ./my-artifacts        (custom output directory)
#   --diff ./baseline              (compare against baseline screenshots)
```

### `proofshot diff`

Compare current state against baseline screenshots.

```bash
proofshot diff --baseline ./previous-artifacts
# Outputs: diff images with changed pixels highlighted in red + mismatch percentage
```

### `proofshot clean`

Remove artifact files.

```bash
proofshot clean
# Removes ./proofshot-artifacts/
```

### `proofshot pr`

Format artifacts for inclusion in a PR description.

```bash
proofshot pr
# Outputs: markdown snippet with embedded screenshot links suitable for GitHub PR body
# Can be piped: proofshot pr >> pr-body.md
```

---

## 5. Dev Server Detection

### Framework Detection Logic

ProofShot reads `package.json` to detect the framework and infer the dev command + port:

```typescript
const FRAMEWORK_DETECTORS = [
  // Next.js
  {
    detect: (pkg) => pkg.dependencies?.['next'] || pkg.devDependencies?.['next'],
    command: 'npm run dev',
    port: 3000,
    waitForText: 'ready on',
    name: 'Next.js'
  },
  // Vite (covers Vue, React+Vite, Svelte, etc.)
  {
    detect: (pkg) => pkg.devDependencies?.['vite'],
    command: 'npm run dev',
    port: 5173,
    waitForText: 'Local:',
    name: 'Vite'
  },
  // Remix
  {
    detect: (pkg) => pkg.dependencies?.['@remix-run/node'],
    command: 'npm run dev',
    port: 3000,
    waitForText: 'started',
    name: 'Remix'
  },
  // Astro
  {
    detect: (pkg) => pkg.dependencies?.['astro'] || pkg.devDependencies?.['astro'],
    command: 'npm run dev',
    port: 4321,
    waitForText: 'watching for file changes',
    name: 'Astro'
  },
  // Create React App
  {
    detect: (pkg) => pkg.dependencies?.['react-scripts'],
    command: 'npm start',
    port: 3000,
    waitForText: 'Compiled',
    name: 'Create React App'
  },
  // Nuxt
  {
    detect: (pkg) => pkg.dependencies?.['nuxt'] || pkg.devDependencies?.['nuxt'],
    command: 'npm run dev',
    port: 3000,
    waitForText: 'Listening on',
    name: 'Nuxt'
  },
  // SvelteKit
  {
    detect: (pkg) => pkg.devDependencies?.['@sveltejs/kit'],
    command: 'npm run dev',
    port: 5173,
    waitForText: 'Local:',
    name: 'SvelteKit'
  },
  // Angular
  {
    detect: (pkg) => pkg.dependencies?.['@angular/core'],
    command: 'npm start',
    port: 4200,
    waitForText: 'Compiled successfully',
    name: 'Angular'
  },
  // Fallback: look for "dev" script in package.json
  {
    detect: (pkg) => pkg.scripts?.dev,
    command: 'npm run dev',
    port: 3000,
    waitForText: null,  // fall back to port detection
    name: 'Unknown (has dev script)'
  }
];
```

### Server Startup Logic

```typescript
async function startDevServer(config): Promise<void> {
  // 1. Check if server is already running on the port
  if (await isPortOpen(config.port)) {
    console.log(`Dev server already running on :${config.port}`);
    return;
  }

  // 2. Start the dev server as a background process
  const proc = spawn(config.command, { shell: true, stdio: 'pipe', detached: true });

  // 3. Wait for ready signal
  await Promise.race([
    waitForText(proc.stdout, config.waitForText),  // watch stdout for ready message
    waitForPort(config.port),                        // or just wait for port to open
    timeout(config.startupTimeout)                   // timeout after 30s
  ]);

  // 4. Additional wait for stability
  await sleep(1000);
}
```

---

## 6. Skill File (Critical for Adoption)

The skill file is what makes this "zero effort" for the user. It teaches the AI agent when and how to use ProofShot.

### Claude Code Skill: `.claude/skills/proofshot/SKILL.md`

```markdown
---
name: proofshot
description: Visual verification of UI features. Use after building or modifying any
  UI component, page, or visual feature. Automatically starts the dev server, opens
  a headless browser, navigates to relevant pages, records video, takes screenshots,
  and generates a verification report.
allowed-tools: Bash(proofshot:*), Bash(agent-browser:*)
---

# ProofShot — Visual Verification

## When to use

Use ProofShot after:
- Building a new UI feature or page
- Modifying existing UI components
- Fixing a visual bug
- Any change that affects what the user sees

## Quick verification (most common)

After completing UI work, run:

```bash
proofshot verify --pages "/relevant-page"
```

This starts the dev server, opens the page, records video, takes screenshots,
and produces a summary in ./proofshot-artifacts/.

## Interactive verification (for complex features)

For features that need click-through testing:

```bash
# Start verification with interaction mode
proofshot verify --pages "/dashboard" --interact
```

Then use agent-browser commands to interact:

```bash
agent-browser snapshot -i                    # See interactive elements
agent-browser click @e3                      # Click a button
agent-browser fill @e2 "test@example.com"    # Fill a form
agent-browser screenshot ./proofshot-artifacts/after-click.png
```

When done interacting:

```bash
agent-browser record stop
```

## Visual regression check

Compare current state to previous screenshots:

```bash
proofshot diff --baseline ./proofshot-artifacts-previous
```

## Tips

- Always verify the specific pages you changed, not the entire app
- For forms, use --interact mode to fill and submit
- Check the console errors in the summary output
- Include the summary file path in your commit message or PR
```

### Cursor Rule: `.cursor/rules/proofshot.mdc`

```markdown
---
description: Visual verification of UI changes using ProofShot
globs: ["**/*.tsx", "**/*.jsx", "**/*.vue", "**/*.svelte", "**/*.html"]
---

After modifying UI files, visually verify changes:

1. Run `proofshot verify --pages "/affected-page"` to start dev server, record video, and take screenshots
2. For interactive features, use `proofshot verify --interact` then `agent-browser` commands
3. Check ./proofshot-artifacts/SUMMARY.md for results
4. Use `proofshot diff --baseline ./previous` to compare against previous state
```

### Generic (AGENTS.md / PROOFSHOT.md)

```markdown
# ProofShot Visual Verification

After building or modifying UI features, verify visually:

```bash
# Basic verification
proofshot verify --pages "/page-you-changed"

# Interactive verification (click through features)
proofshot verify --pages "/page" --interact
# Then use agent-browser commands: snapshot -i, click @e1, fill @e2 "text", etc.
# Finish with: agent-browser record stop

# Visual regression
proofshot diff --baseline ./previous-artifacts
```

Artifacts are saved to ./proofshot-artifacts/ including video, screenshots, and summary.
```

---

## 7. Project Structure

```
proofshot/
├── package.json
├── tsconfig.json
├── README.md
├── LICENSE                      # MIT
├── bin/
│   └── proofshot.ts             # CLI entry point
├── src/
│   ├── index.ts                 # Main exports
│   ├── cli.ts                   # CLI argument parsing (use commander.js)
│   ├── commands/
│   │   ├── init.ts              # proofshot init
│   │   ├── verify.ts            # proofshot verify (main command)
│   │   ├── diff.ts              # proofshot diff
│   │   ├── clean.ts             # proofshot clean
│   │   └── pr.ts                # proofshot pr
│   ├── server/
│   │   ├── detect.ts            # Framework detection
│   │   ├── start.ts             # Dev server startup
│   │   └── wait.ts              # Port/text waiting utilities
│   ├── browser/
│   │   ├── session.ts           # agent-browser session management
│   │   ├── navigate.ts          # Page navigation + waiting
│   │   ├── capture.ts           # Screenshot + recording orchestration
│   │   └── interact.ts          # Interactive mode bridge
│   ├── artifacts/
│   │   ├── bundle.ts            # Collect all artifacts
│   │   ├── summary.ts           # Generate SUMMARY.md
│   │   └── pr-format.ts         # Format for PR description
│   └── utils/
│       ├── exec.ts              # Shell command execution
│       ├── port.ts              # Port detection utilities
│       └── config.ts            # Config file reading/writing
├── skills/
│   ├── claude/SKILL.md
│   ├── cursor/proofshot.mdc
│   ├── codex/AGENTS.md
│   └── generic/PROOFSHOT.md
└── test/
    ├── detect.test.ts
    ├── verify.test.ts
    └── fixtures/
        ├── nextjs-app/
        └── vite-app/
```

---

## 8. Implementation Plan (Build Order)

### Phase 1 — Core (MVP, ship this first)

**Goal:** `proofshot verify` works end-to-end for a Next.js app with Claude Code.

1. **Project setup** — TypeScript, tsconfig, commander.js, build pipeline
2. **Config module** — Read/write `proofshot.config.json`
3. **Framework detection** — Detect Next.js and Vite (cover 80% of users)
4. **Dev server management** — Start, wait for ready, detect already running
5. **Browser session** — Wrap agent-browser commands via child_process.execSync
6. **Verify command** — Orchestrate: start server → open browser → navigate pages → screenshot → record → generate summary
7. **Summary generator** — Create SUMMARY.md with screenshots and metadata
8. **CLI entry point** — Wire up commander.js with verify command
9. **Claude Code skill file** — Write and test with Claude Code
10. **README** — Installation, quick start, examples

### Phase 2 — Polish

11. **Init command** — Interactive setup with framework detection
12. **More framework detectors** — Remix, Astro, Angular, Nuxt, SvelteKit
13. **Diff command** — Visual regression using agent-browser diff
14. **PR command** — Format artifacts for GitHub PR body
15. **Skill files for other agents** — Cursor, Codex, Gemini, Copilot
16. **Clean command** — Remove artifacts
17. **Error handling** — Graceful failures, helpful messages
18. **CI mode** — For running in GitHub Actions (no interactive prompts)

### Phase 3 — Growth

19. **Interactive mode** — Let agent click through after initial screenshots
20. **Custom verification scripts** — User defines flows in a config file
21. **PR integration** — Auto-attach artifacts to GitHub PR via CLI
22. **Baseline management** — Save/compare baselines across branches
23. **npm publish** — Publish to npm, set up CI for releases

---

## 9. Key Implementation Details

### How We Wrap agent-browser

We do NOT import agent-browser as a library. We call it via CLI (child_process). This is intentional:

```typescript
import { execSync } from 'child_process';

function ab(command: string): string {
  try {
    return execSync(`agent-browser ${command}`, {
      encoding: 'utf-8',
      timeout: 30000,
      stdio: ['pipe', 'pipe', 'pipe']
    }).trim();
  } catch (error) {
    // Handle errors, extract stderr
    throw new ProofShotError(`Browser command failed: ${command}`, error);
  }
}

// Usage:
ab('open http://localhost:3000');
ab('wait --load networkidle');
ab('record start ./artifacts/session.webm');
ab('screenshot ./artifacts/page-home.png');
ab('snapshot -i');  // returns accessibility tree
ab('record stop');
ab('close');
```

Why CLI wrapping:
- agent-browser's Rust CLI + daemon architecture is designed to be called via CLI
- No need to maintain compatibility with its internal APIs
- Same approach the agent itself uses — keeps things simple
- agent-browser daemon stays warm between calls (fast)

### Video Recording Flow

```typescript
async function verifyWithRecording(config, pages: string[]) {
  const outputDir = config.output || './proofshot-artifacts';
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

  // Start browser + recording
  ab(`open http://localhost:${config.port}${pages[0]}`);
  ab(`set viewport ${config.viewport.width} ${config.viewport.height}`);
  ab(`record start ${outputDir}/session-${timestamp}.webm`);

  const pageResults = [];

  for (const page of pages) {
    // Navigate
    ab(`open http://localhost:${config.port}${page}`);
    ab('wait --load networkidle');

    // Screenshot
    const screenshotPath = `${outputDir}/page-${slugify(page)}.png`;
    ab(`screenshot ${screenshotPath} --full`);

    // Get page info
    const title = ab('get title');
    const url = ab('get url');
    const snapshot = ab('snapshot -i');
    const errors = ab('errors');
    const consoleOutput = ab('console');

    pageResults.push({
      page, title, url, screenshotPath,
      snapshot, errors, consoleOutput
    });
  }

  // Stop recording
  ab('record stop');

  // Close browser
  ab('close');

  return { pageResults, videoPath: `${outputDir}/session-${timestamp}.webm` };
}
```

### Dev Server Lifecycle

Important: ProofShot starts the dev server but does NOT kill it when done. The agent may want to keep using it. We just track whether WE started it so we can tell the user.

```typescript
let weStartedServer = false;

async function ensureDevServer(config) {
  if (await isPortOpen(config.devServer.port)) {
    return; // Already running, we didn't start it
  }

  const proc = spawn('sh', ['-c', config.devServer.command], {
    cwd: process.cwd(),
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true  // Don't die when proofshot exits
  });

  proc.unref();  // Let it keep running
  weStartedServer = true;

  // Wait for ready
  await waitForReady(proc, config.devServer);
}
```

---

## 10. Dependencies

```json
{
  "name": "proofshot",
  "version": "0.1.0",
  "description": "Visual verification for AI coding agents",
  "bin": {
    "proofshot": "./dist/bin/proofshot.js"
  },
  "dependencies": {
    "agent-browser": "latest",
    "commander": "^12.0.0",
    "chalk": "^5.0.0",
    "detect-port": "^2.0.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "vitest": "^2.0.0",
    "tsup": "^8.0.0"
  },
  "engines": {
    "node": ">=18"
  },
  "license": "MIT",
  "keywords": [
    "ai", "coding", "agent", "visual", "testing", "verification",
    "browser", "automation", "screenshot", "video", "recording",
    "claude-code", "cursor", "codex", "copilot"
  ]
}
```

---

## 11. README (Draft)

```markdown
# 🎬 ProofShot

**Give any AI coding agent eyes.**

Your agent builds a feature → ProofShot records video proof it works.

Works with: Claude Code · Codex · Cursor · Gemini CLI · GitHub Copilot · Windsurf · any agent that runs bash.

## Why?

Cursor's $200/mo cloud agents can test their own UI and record video demos.
ProofShot gives you the same capability for free, with any agent.

## Install

\`\`\`bash
npm install -g proofshot
\`\`\`

## Setup (10 seconds)

\`\`\`bash
cd your-project
proofshot init
\`\`\`

## Use

Tell your AI agent:
> "Verify the changes visually with proofshot"

Or run directly:
\`\`\`bash
proofshot verify --pages "/dashboard"
\`\`\`

You get: a video recording, annotated screenshots, and a summary — all in `./proofshot-artifacts/`.

## How It Works

1. Detects your framework (Next.js, Vite, etc.) and starts the dev server
2. Opens a headless browser (doesn't touch your screen)
3. Navigates to each page, waits for load
4. Records video of the entire session
5. Takes screenshots of each page
6. Generates a markdown summary

Built on [agent-browser](https://github.com/vercel-labs/agent-browser) by Vercel — fast, context-efficient, works with every AI coding agent.

## License

MIT
\`\`\`

---

## 12. Open Questions (To Decide During Build)

1. **Name:** "ProofShot" is a working name. Alternatives: VerifyAI, AgentEyes, ProofShot, DemoBot, ShowMe. Need to check npm availability.
2. **agent-browser as dependency vs peer dependency:** If we make it a regular dep, npm install handles everything. If peer dep, user might already have it. Start with regular dep for simplicity.
3. **Video format:** agent-browser records .webm. Should we also offer .mp4 conversion? (webm plays natively in browsers and GitHub, so probably fine as-is.)
4. **Interactive mode complexity:** In v1, keep it simple — just navigate and screenshot. Interactive clicking can be Phase 2.
5. **Monorepo support:** For now, assume single project root. Monorepo detection is Phase 3.
