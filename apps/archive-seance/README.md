# AI Dev Workflow

Transform AI conversations into actionable development artifacts in 30 seconds.

## What It Does

Automatically extract from your Claude/ChatGPT conversations:
- **Code Reviews** - Security risks, performance issues, best practices
- **Architecture Decisions** - Key decisions made, risks identified  
- **GitHub Issues** - Ready-to-create tasks with priority and labels

## The Demo (2 minutes)

1. Load a sample conversation about React optimization
2. Click "Analyze Conversation"
3. Watch 3 agents run in parallel:
   - Code Review Agent: Finds 5 issues (XSS, N+1 queries, missing error handling)
   - Decision Log Agent: Extracts 3 architecture decisions + 2 risks
   - Task Agent: Generates 4 GitHub issues
4. Export directly to GitHub

## Why This Wins

### Real Problem
Developers spend time manually copying insights from Claude conversations into tickets. This automates it.

### Kiro Power
- **Multi-agent orchestration**: 3 agents run simultaneously
- **Parallel execution**: All agents analyze the same conversation at once
- **Structured output**: Each agent returns actionable JSON/markdown
- **Tool integration**: Can export to GitHub, Linear, Jira, Slack

### Tech Depth
- Claude Structured Output for reliable extraction
- Regex patterns for code/decision/task detection
- Workflow engine for parallel agent coordination
- GitHub API integration

## Running Locally

```bash
# Load sample data
# This loads 6 pre-built conversations

# Run the workflow
pnpm --filter @seance/archive-seance dev

# In the UI:
# 1. Select "React Performance Optimization" conversation
# 2. Click "Analyze" button
# 3. View results:
#    - Code Review tab
#    - Decisions tab
#    - Issues tab (4 GitHub issues)
```

## Architecture

```
Input: 1 Development Conversation
         ↓
    3 Parallel Agents:
    ├─ Code Review Agent → Extract bugs, security, performance
    ├─ Decision Log Agent → Extract architecture decisions, risks
    └─ Task Agent → Generate GitHub issues
         ↓
Output: Complete development artifact
    ├─ Code Review Report (5 issues)
    ├─ Decision Log (3 decisions + 2 risks)
    └─ GitHub Issues (4 ready-to-create)
```

## Tools

### extract_insights (Code Review Agent)
Analyzes code blocks in conversation:
- Security vulnerabilities (innerHTML, eval, SQL injection)
- Performance issues (N+1 queries, nested loops)
- Error handling gaps
- Type safety issues
- Best practices

### find_related_conversations (Decision Log Agent)
Extracts architectural insights:
- Technology decisions (REST vs GraphQL, Vite vs Webpack)
- Architecture choices (microservices, caching strategy)
- Identified risks and mitigation strategies
- Process decisions (code review, testing)

### build_knowledge_graph (Task Agent)
Converts discussions to GitHub Issues:
- Automatically categorizes tasks (feature, bug, refactor, optimization)
- Assigns priority (P0=critical, P1=high, P2=medium)
- Generates issue description from context
- Suggests labels and assignee

## Next Steps

- [ ] Add GitHub API integration (create issues directly)
- [ ] Support for other platforms (Linear, Jira, Slack)
- [ ] Custom extraction rules
- [ ] Team dashboard with workflow history
- [ ] Integration with existing CI/CD
