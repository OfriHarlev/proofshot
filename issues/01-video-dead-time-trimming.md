# Issue: Video Dead Time Trimming

## Problem

When `proofshot start` runs, video recording begins immediately. But the AI agent takes 20-30 seconds to think/plan before it actually touches `agent-browser`. This means the first 20-30 seconds of the .webm video is a static frame with nothing happening. Similarly, the agent may finish its last action but take time before running `proofshot stop`, creating dead time at the end.

The human watching the proof video sees nothing for 30 seconds, then the actual testing, then nothing again. Bad experience.

## Solution

Add a post-processing step in `proofshot stop` that trims the video to only include the active portion — starting a few seconds before the first action and ending a few seconds after the last action.

## Implementation

### Approach: ffmpeg trim based on screenshot timestamps

1. In `proofshot stop`, after collecting all artifacts, look at the file creation timestamps of all `.png` screenshots in the output directory.

2. Calculate:
   - `firstActionTime` = earliest screenshot file creation time
   - `lastActionTime` = latest screenshot file creation time
   - `recordingStartTime` = session `startedAt` from `.session.json`

3. Compute trim points:
   - `trimStart` = max(0, firstActionTime - recordingStartTime - 2 seconds)
   - `trimEnd` = lastActionTime - recordingStartTime + 2 seconds

4. If ffmpeg is available on the system, run:
   ```bash
   ffmpeg -i session-raw.webm -ss {trimStart} -to {trimEnd} -c copy session.webm
   ```

5. If ffmpeg is NOT available, skip trimming silently and keep the original video. Log a hint:
   ```
   Tip: Install ffmpeg to auto-trim dead time from videos.
   ```

### Files to change

- **`src/commands/stop.ts`** — After generating the summary, add the trimming step:
  1. Find all `.png` files in outputDir, get their `fs.statSync(f).birthtimeMs`
  2. Calculate trim points relative to session start
  3. Check if ffmpeg exists: `which ffmpeg` or `execSync('ffmpeg -version')`
  4. If yes, run ffmpeg to create trimmed video, replace original
  5. If no, skip and optionally print hint

- **`src/commands/start.ts`** — No changes needed. Recording still starts immediately (we need the full raw video to trim from).

### Edge cases

- **No screenshots taken**: Don't trim. The agent might have only used `snapshot` and `click` without taking screenshots. Keep full video.
- **Only one screenshot**: Trim to 5 seconds before and 5 seconds after that single timestamp.
- **ffmpeg not installed**: Skip silently. This is an enhancement, not a requirement.
- **Very short video (<5 seconds)**: Don't trim.

### Testing

1. Go to `test/fixtures/sample-app`
2. Run `proofshot start --description "test trimming"`
3. Wait 10 seconds (simulate agent thinking)
4. Run `agent-browser screenshot ./proofshot-artifacts/step-1.png`
5. Wait 2 seconds
6. Run `agent-browser screenshot ./proofshot-artifacts/step-2.png`
7. Wait 10 seconds (simulate agent thinking after done)
8. Run `proofshot stop`
9. Check that the video is ~6 seconds long (2s buffer + 2s between screenshots + 2s buffer), not 24 seconds

### Effort estimate

Small — ~30 minutes. One function in `stop.ts`, optional ffmpeg dependency.
