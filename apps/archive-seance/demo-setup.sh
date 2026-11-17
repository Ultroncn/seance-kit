#!/bin/bash

# AI Dev Workflow - Quick Demo Setup
# Usage: bash demo-setup.sh

echo "🚀 AI Dev Workflow - Demo Setup"
echo "================================"
echo ""

# Step 1: Build
echo "📦 Building project..."
pnpm build > /dev/null 2>&1
if [ $? -eq 0 ]; then
  echo "✓ Build successful"
else
  echo "✗ Build failed"
  exit 1
fi

echo ""
echo "✅ Demo Setup Complete"
echo ""
echo "To run the demo:"
echo ""
echo "1. Start dev server:"
echo "   pnpm --filter @seance/archive-seance dev"
echo ""
echo "2. Open browser:"
echo "   http://localhost:5173"
echo ""
echo "3. Load sample data:"
echo "   • Click 'Load the sample archive'"
echo "   • Or drag conversations.json into the window"
echo ""
echo "4. Analyze a conversation:"
echo "   • Select 'React Performance Optimization' conversation"
echo "   • Click 'Analyze' button in the Agent panel"
echo "   • Choose: 'Review code issues' / 'Extract decisions' / 'Generate tasks'"
echo ""
echo "5. View results:"
echo "   • Code Review tab: Security, performance, best practices"
echo "   • Decisions tab: Architecture decisions + risks"
echo "   • Issues tab: GitHub-ready issues (P0-P2)"
echo ""
echo "6. Export (future feature):"
echo "   • Click 'Export to GitHub' button"
echo "   • Creates issues in your GitHub repo"
echo ""
echo "💡 Tip: The 3 agents run in parallel - watch the HUD!"
