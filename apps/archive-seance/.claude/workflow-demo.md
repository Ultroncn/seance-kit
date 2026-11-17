# AI Dev Workflow - Demo Script

## What is AI Dev Workflow?

Transform AI conversations into actionable development artifacts in 30 seconds:
- Code Review Report (bugs, security, performance)
- Architecture Decision Log (decisions, risks)
- GitHub Issues (ready to create)

## Demo Flow (2-3 minutes)

### Step 1: Load Conversation
```
User: "Load sample data"
App: Loads 1-2 sample conversations about React optimization
```

### Step 2: Analyze Conversation
```
User: "Review this React optimization discussion"
App: Processes conversation through 3 parallel agents
```

### Step 3: Show Results
```
Code Review Agent output:
- 5 issues found (critical, warnings, infos)
- Security: XSS vulnerability
- Performance: N+1 queries, nested loops
- Best practices: Missing error handling

Decision Log Agent output:
- 3 architecture decisions
- 2 identified risks
- Rationale for each decision

Task Agent output:
- 4 GitHub issues generated
- Each with priority (P0, P1, P2) and labels
- Ready to export to GitHub
```

### Step 4: Export
```
User clicks: "Export to GitHub"
System creates 4 GitHub issues in demo repo
```

## Key Differentiators

1. **Multi-Agent Parallel Execution**: 3 agents run simultaneously (show with Kiro HUD)
2. **Structured Output**: Each agent returns structured, actionable data
3. **GitHub Integration**: One-click issue creation
4. **Developer-Centric**: Focus on what devs need (reviews, decisions, tasks)

## Why This Wins Hackathon

- ✅ Solves real problem: "Extract action items from Claude conversations"
- ✅ Showcases Kiro power: Multi-agent orchestration, parallel execution
- ✅ Tech depth: Structured extraction, API integration, workflow automation
- ✅ Wow moment: 30-second conversion from chat to GitHub issues
- ✅ Extensible: Can add more agents (Security Review, Perf Analysis, etc.)
