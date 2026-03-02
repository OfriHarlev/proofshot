#!/bin/bash
set -e

# Path to proofshot CLI (built version)
PROOFSHOT="node $(dirname "$0")/../../../dist/bin/proofshot.js"

echo "=== ProofShot E2E Test ==="
echo ""

# Step 1: Start session
echo "--- Step 1: proofshot start ---"
$PROOFSHOT start --run "npm run dev" --port 5173 --description "Verify all 3 pages load: home, dashboard, settings"
echo ""

# Step 2: Agent drives the browser
echo "--- Step 2: Agent testing with agent-browser ---"
agent-browser snapshot -i
agent-browser screenshot ./proofshot-artifacts/step-home.png
agent-browser open http://localhost:5173/dashboard.html
agent-browser screenshot ./proofshot-artifacts/step-dashboard.png
agent-browser open http://localhost:5173/settings.html
agent-browser screenshot ./proofshot-artifacts/step-settings.png
echo ""

# Step 3: Stop session
echo "--- Step 3: proofshot stop ---"
$PROOFSHOT stop
echo ""

# Step 4: Check artifacts
echo "--- Step 4: Check artifacts ---"
ls -la proofshot-artifacts/
echo ""
cat proofshot-artifacts/SUMMARY.md
echo ""

# Step 5: PR format
echo "--- Step 5: proofshot pr ---"
$PROOFSHOT pr
echo ""

# Step 6: Clean
echo "--- Step 6: proofshot clean ---"
$PROOFSHOT clean
echo ""

echo "=== All tests passed ==="
