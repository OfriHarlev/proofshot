# Issue: Interactive Timeline Viewer

## Problem

The human gets a .webm video and screenshots as proof, but has no way to understand **what the agent actually did** step by step. They can't see:
- Which pages were navigated to
- Which elements were clicked
- What was typed into forms
- The timeline of actions with timestamps

The video is a passive recording. The human wants an interactive view where they can see every action, click on a step, and jump to that moment in the video.

## User's Vision

A standalone HTML file that shows:
- **Left side:** the .webm video player
- **Right side:** a timeline panel listing every action the agent took, with icons and timestamps
- **Clickable:** click any step on the timeline → the video seeks to that timestamp
- **Shareable:** a single file the human can open in any browser, attach to a PR, send to a PM, or link from a Linear ticket

## Options Considered

### Option A: `proofshot exec` wrapper (CHOSEN)

The agent uses `proofshot exec click @e3` instead of `agent-browser click @e3`. ProofShot logs the command + timestamp to a JSON file, then passes through to agent-browser.

- Pro: Simple, reliable, we control the data format completely
- Pro: 20 lines of code for the logger
- Pro: No dependency on internal formats
- Con: Changes the agent's workflow slightly (different command prefix in the skill file)

### Option B: Playwright Trace (REJECTED)

Use `agent-browser trace start` / `trace stop` to capture a Playwright trace, then either use Playwright's Trace Viewer or parse the trace zip.

- Con: Playwright's Trace Viewer requires `npx playwright show-trace` or uploading to trace.playwright.dev — not shareable, not embeddable, not standalone
- Con: Parsing the trace zip depends on Playwright's internal format — fragile
- Con: The `--screenshots` / `--snapshots` flags add performance overhead that isn't needed since we have the video
- Con: The viewer is a developer debugging tool, not a "proof for humans" tool
- Pro: No change to agent workflow
- Pro: Captures everything including things the agent didn't explicitly command

### Option C: Unix socket sniffing (REJECTED)

Intercept the Unix socket between agent-browser CLI and daemon.

- Con: Fragile, depends on internal socket protocol
- Con: Complex implementation
- Con: Hard to maintain across agent-browser versions

### Why Option A wins

The goal is to show proof to a human. That means a standalone, shareable HTML file. Neither Playwright's Trace Viewer nor socket sniffing gives us that. `proofshot exec` gives us clean, structured data that we control, and the skill file change is trivial (replace `agent-browser` with `proofshot exec` in the instructions).

## Implementation

### Part 1: `proofshot exec` command

Create `src/commands/exec.ts`:

```typescript
// proofshot exec <agent-browser-args...>
// 1. Read session state to get outputDir and startedAt
// 2. Calculate timestamp relative to session start
// 3. Append { command, args, timestamp, relativeTime } to session-log.json
// 4. Pass through to agent-browser and return its output
```

The command is a thin passthrough:
```bash
proofshot exec snapshot -i
# → logs: { "action": "snapshot -i", "relativeTimeSec": 3.2, "timestamp": "2026-02-27T..." }
# → runs: agent-browser snapshot -i
# → returns: the snapshot output to stdout
```

**Session log format** (`session-log.json` in the output dir):
```json
[
  { "action": "snapshot -i", "relativeTimeSec": 3.2, "timestamp": "2026-02-27T14:32:03Z" },
  { "action": "open http://localhost:5173/settings.html", "relativeTimeSec": 5.1, "timestamp": "2026-02-27T14:32:05Z" },
  { "action": "fill @e1 \"John Smith\"", "relativeTimeSec": 8.7, "timestamp": "2026-02-27T14:32:08Z" },
  { "action": "click @e5", "relativeTimeSec": 10.3, "timestamp": "2026-02-27T14:32:10Z" },
  { "action": "screenshot ./proofshot-artifacts/step-settings.png", "relativeTimeSec": 12.0, "timestamp": "2026-02-27T14:32:12Z" }
]
```

**Icon mapping** for the viewer — each command type gets an icon:
- `open` / `navigate` → compass/navigation icon
- `click` → pointer/cursor icon
- `fill` / `type` → keyboard/text icon
- `screenshot` → camera icon
- `snapshot` → eye icon
- `scroll` → scroll icon
- `press` → key icon

### Part 2: HTML timeline viewer

Create `src/artifacts/viewer.ts` that generates a standalone `viewer.html`:

The HTML file contains:
- Inline CSS (dark theme matching the sample app aesthetic)
- A `<video>` element referencing the .webm file (relative path)
- A timeline panel built from the session log data (embedded as inline JSON)
- Inline JS that handles: click on timeline step → `video.currentTime = step.relativeTimeSec`
- Active step highlighting as the video plays (the timeline follows the video)
- Duration labels and action descriptions for each step

**Structure of the HTML:**
```html
<!DOCTYPE html>
<html>
<head>
  <title>ProofShot — Verification Report</title>
  <style>
    /* Dark theme, two-panel layout */
    /* Left: video player (60% width) */
    /* Right: scrollable timeline (40% width) */
    /* Timeline items: icon + action text + timestamp */
    /* Active item highlighted as video plays */
  </style>
</head>
<body>
  <div class="header">
    <h1>ProofShot Verification</h1>
    <p class="description">{{ description }}</p>
    <p class="meta">{{ date }} · {{ framework }} · {{ duration }}</p>
  </div>
  <div class="viewer">
    <div class="video-panel">
      <video src="./session-TIMESTAMP.webm" controls></video>
    </div>
    <div class="timeline-panel">
      <div class="step" data-time="3.2" onclick="seekTo(3.2)">
        <span class="icon">👁</span>
        <span class="action">snapshot -i</span>
        <span class="time">0:03</span>
      </div>
      <!-- ... more steps ... -->
    </div>
  </div>
  <div class="errors">
    <h2>Console Errors</h2>
    <p>No console errors detected.</p>
    <h2>Server Errors</h2>
    <p>No server errors detected.</p>
  </div>
  <script>
    const video = document.querySelector('video');
    const steps = document.querySelectorAll('.step');

    function seekTo(time) {
      video.currentTime = time;
      video.play();
    }

    // Highlight active step as video plays
    video.addEventListener('timeupdate', () => {
      const t = video.currentTime;
      steps.forEach(step => {
        const stepTime = parseFloat(step.dataset.time);
        const nextStep = step.nextElementSibling;
        const nextTime = nextStep ? parseFloat(nextStep.dataset.time) : Infinity;
        step.classList.toggle('active', t >= stepTime && t < nextTime);
      });
    });
  </script>
</body>
</html>
```

### Part 3: Wire it into `proofshot stop`

In `src/commands/stop.ts`, after generating SUMMARY.md:

1. Read `session-log.json` from the output directory
2. If it exists (agent used `proofshot exec`), generate `viewer.html`
3. Add viewer path to the stop output:
   ```
   🎬 Viewer:        ./proofshot-artifacts/viewer.html
   ```
4. If `session-log.json` doesn't exist (agent used `agent-browser` directly), skip viewer generation and print a hint:
   ```
   Tip: Use "proofshot exec" instead of "agent-browser" to get an interactive timeline viewer.
   ```

### Part 4: Update skill files

Replace `agent-browser` with `proofshot exec` in all skill files:

```markdown
### Step 2: Drive the browser and test

Use proofshot exec to navigate, interact, and verify:

proofshot exec snapshot -i                                    # See interactive elements
proofshot exec open http://localhost:PORT/page                # Navigate to a page
proofshot exec click @e3                                      # Click a button
proofshot exec fill @e2 "test@example.com"                    # Fill a form field
proofshot exec screenshot ./proofshot-artifacts/step-NAME.png # Capture key moments
```

### Part 5: Update CLI

In `src/cli.ts`, register the `exec` command:

```typescript
program
  .command('exec')
  .description('Run an agent-browser command with logging (use instead of agent-browser directly)')
  .argument('<args...>', 'agent-browser command and arguments')
  .action(async (args) => {
    await execCommand(args);
  });
```

### Files to create

| File | Purpose |
|------|--------|
| `src/commands/exec.ts` | The `proofshot exec` passthrough + logger |
| `src/artifacts/viewer.ts` | HTML viewer generator |

### Files to change

| File | Change |
|------|--------|
| `src/cli.ts` | Register `exec` command |
| `src/commands/stop.ts` | Read session log, generate viewer.html, add to output |
| `skills/claude/SKILL.md` | Replace `agent-browser` with `proofshot exec` |
| `skills/cursor/proofshot.mdc` | Replace `agent-browser` with `proofshot exec` |
| `skills/codex/AGENTS.md` | Replace `agent-browser` with `proofshot exec` |
| `skills/generic/PROOFSHOT.md` | Replace `agent-browser` with `proofshot exec` |
| `src/commands/init.ts` | Update inline skill content |

## Performance Impact

Near-zero. `proofshot exec` adds:
- One `fs.readFileSync` to load session state (~1ms)
- One JSON parse + stringify + `fs.appendFileSync` to the log (~1ms)
- One `execSync` to agent-browser (same as before)

Total overhead per command: ~2ms. Completely imperceptible.

## Testing

1. Go to `test/fixtures/sample-app`
2. `proofshot init --agent claude --force`
3. `proofshot start --description "Test timeline viewer"`
4. `proofshot exec open http://localhost:5173/settings.html`
5. `proofshot exec snapshot -i`
6. `proofshot exec fill @e1 "New Name"`
7. `proofshot exec screenshot ./proofshot-artifacts/step-settings.png`
8. `proofshot stop`
9. Verify `viewer.html` exists in `proofshot-artifacts/`
10. Open `viewer.html` in a browser
11. Confirm: video on left, timeline on right, clicking a step seeks the video
12. Verify `session-log.json` has 4 entries with correct relative timestamps

## Effort Estimate

| Component | Effort |
|-----------|--------|
| `proofshot exec` command | Small (~20 min) |
| HTML viewer generator | Medium (~1-2 hours) |
| Wire into `proofshot stop` | Small (~15 min) |
| Update skill files | Small (~15 min) |
| **Total** | **~2-3 hours** |
