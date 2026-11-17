import type { Conversation } from "@seance/core";

/**
 * Sample conversations demonstrating AI Memory Bank capabilities.
 * These show code snippets, decisions, learnings, and knowledge connections.
 */
export const sampleConversations: Conversation[] = [
  {
    id: "conv-react-optimization",
    title: "React Performance Optimization Strategies",
    source: "Claude",
    messages: [
      {
        role: "user",
        content:
          "We're experiencing performance issues in our React app. We have 500+ components and initial load is slow. What are the best strategies to optimize?",
      },
      {
        role: "assistant",
        content: `Here are the key React optimization strategies:

1. **Code Splitting & Lazy Loading**
\`\`\`tsx
const Dashboard = lazy(() => import('./Dashboard'));
const Analytics = lazy(() => import('./Analytics'));

<Suspense fallback={<Loading />}>
  <Dashboard />
</Suspense>
\`\`\`

2. **Memoization for expensive renders**
\`\`\`tsx
const MemoizedComponent = memo(Component, (prevProps, nextProps) => {
  return prevProps.id === nextProps.id;
});
\`\`\`

3. **Virtualization for long lists**
\`\`\`tsx
import { FixedSizeList } from 'react-window';

<FixedSizeList
  height={600}
  itemCount={10000}
  itemSize={35}
>
  {Row}
</FixedSizeList>
\`\`\`

Key decision: We recommend profiling first with React DevTools Profiler before optimizing. Most performance wins come from identifying and fixing the biggest bottlenecks first.

Remember: Premature optimization is the root of all evil. Measure, identify, then optimize.`,
      },
      {
        role: "user",
        content:
          "This is really helpful. We'll start with code splitting and profiling. Should we use Vite or Next.js for this project?",
      },
      {
        role: "assistant",
        content:
          "Decision: Choose based on needs:\n- **Vite**: Faster builds, simpler setup, great for SPAs\n- **Next.js**: Better for meta tags, SEO, API routes, full-stack\n\nSince you have 500+ components, both work well. Vite will give you faster dev experience. Next.js gives you routing and API out of the box.",
      },
    ],
    createdAt: new Date("2026-10-15"),
    updatedAt: new Date("2026-10-15"),
    tags: ["react", "performance", "optimization"],
  },

  {
    id: "conv-typescript-migration",
    title: "TypeScript Migration Strategy",
    source: "ChatGPT",
    messages: [
      {
        role: "user",
        content:
          "We have a large JavaScript codebase and want to migrate to TypeScript gradually. What's the recommended approach?",
      },
      {
        role: "assistant",
        content: `TypeScript migration strategy:

**Phase 1: Setup**
1. Install TypeScript and basic config
2. Rename .js files to .ts (won't break anything with loose tsconfig)
3. Set allowJs: true initially

**Phase 2: Gradual Migration**
\`\`\`json
{
  "compilerOptions": {
    "allowJs": true,
    "noImplicitAny": false,
    "strict": false,
    "checkJs": false
  }
}
\`\`\`

**Phase 3: Strict Mode**
Gradually enable: noImplicitAny → strict → noUncheckedIndexedAccess

Decision: Start with utility files and core business logic, not UI components. This gives you the most type safety where it matters.

Key learning: TypeScript ROI comes from catching runtime errors early, especially in shared utilities and API contracts.`,
      },
    ],
    createdAt: new Date("2026-10-10"),
    updatedAt: new Date("2026-10-10"),
    tags: ["typescript", "migration", "javascript"],
  },

  {
    id: "conv-nextjs-api-design",
    title: "Designing Scalable API Endpoints",
    source: "Claude",
    messages: [
      {
        role: "user",
        content:
          "We're building API endpoints for a new product. We expect 1000s of requests/sec. Should we use REST, GraphQL, or something else?",
      },
      {
        role: "assistant",
        content: `Architecture decision: REST vs GraphQL for high-traffic API

**REST (Recommended for your case):**
- ✅ Simpler caching (HTTP caching works out of box)
- ✅ Better performance at scale
- ✅ Easier monitoring and debugging
- ✅ Lower latency

**GraphQL:**
- ✅ More flexible for clients
- ❌ Harder to cache
- ❌ N+1 query problem if not careful
- ❌ More complex monitoring

For 1000s req/sec, I'd choose REST with proper caching strategy.

\`\`\`typescript
// Use caching headers
app.get('/api/users/:id', (req, res) => {
  res.set('Cache-Control', 'public, max-age=300');
  res.json(user);
});
\`\`\`

Also consider: CDN caching, database query optimization, connection pooling.`,
      },
    ],
    createdAt: new Date("2026-10-08"),
    updatedAt: new Date("2026-10-08"),
    tags: ["api", "rest", "graphql", "architecture"],
  },

  {
    id: "conv-database-queries",
    title: "Database Query Optimization",
    source: "Claude",
    messages: [
      {
        role: "user",
        content:
          "Our database queries are slow. We have users table with 1M rows. A simple query joins with posts and comments. Any tips?",
      },
      {
        role: "assistant",
        content: `Database optimization checklist:

**1. Add Indexes**
\`\`\`sql
CREATE INDEX idx_posts_user_id ON posts(user_id);
CREATE INDEX idx_comments_post_id ON comments(post_id);
\`\`\`

**2. Use EXPLAIN ANALYZE**
\`\`\`sql
EXPLAIN ANALYZE
SELECT u.*, p.*, c.*
FROM users u
LEFT JOIN posts p ON u.id = p.user_id
LEFT JOIN comments c ON p.id = c.post_id
WHERE u.id = $1;
\`\`\`

**3. Decision: Pagination over full fetch**
\`\`\`sql
SELECT * FROM posts
WHERE user_id = $1
ORDER BY created_at DESC
LIMIT 50 OFFSET 0;
\`\`\`

**4. Learning: N+1 Query Problem**
❌ Bad: Loop and query for each user
✅ Good: Single query with JOINs

Also consider: materialized views, read replicas, caching layer (Redis).

For 1M rows, proper indexing can give 100x speedup.`,
      },
    ],
    createdAt: new Date("2026-10-05"),
    updatedAt: new Date("2026-10-05"),
    tags: ["database", "sql", "performance", "postgres"],
  },

  {
    id: "conv-ai-integration",
    title: "Integrating Claude API into Production",
    source: "Claude",
    messages: [
      {
        role: "user",
        content:
          "We want to add AI features to our app using Claude. What's the production-ready setup?",
      },
      {
        role: "assistant",
        content: `Production Claude API integration:

**1. Setup with Error Handling**
\`\`\`typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

async function callClaude(prompt: string) {
  try {
    const message = await client.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });
    return message.content[0].type === "text" ? message.content[0].text : null;
  } catch (error) {
    // Handle rate limits, timeouts, etc.
    console.error("Claude API error:", error);
    throw error;
  }
}
\`\`\`

**2. Token Management**
\`\`\`typescript
// Cost: $4/M input, $20/M output for Opus 5.5
// Monitor token usage
console.log("Input tokens:", response.usage.input_tokens);
console.log("Output tokens:", response.usage.output_tokens);
\`\`\`

**3. Decision: Use streaming for long responses**
\`\`\`typescript
const stream = client.messages.stream({
  model: "claude-opus-5-5",
  max_tokens: 1024,
  messages: [{ role: "user", content: prompt }],
});

for await (const event of stream) {
  if (event.type === "content_block_delta") {
    process.stdout.write(event.delta.text);
  }
}
\`\`\`

**Key learning**: Cache system prompts and long contexts for 90% token savings.`,
      },
    ],
    createdAt: new Date("2026-09-28"),
    updatedAt: new Date("2026-09-28"),
    tags: ["ai", "claude", "api", "production"],
  },

  {
    id: "conv-deployment-strategy",
    title: "Deployment Pipeline & CI/CD",
    source: "ChatGPT",
    messages: [
      {
        role: "user",
        content:
          "Setting up CI/CD. Should we use GitHub Actions, GitLab CI, or something else? We deploy to AWS.",
      },
      {
        role: "assistant",
        content: `CI/CD Pipeline Decision:

**For AWS + GitHub: GitHub Actions**
- Native GitHub integration
- 2000 free minutes/month
- Easy AWS IAM integration

\`\`\`yaml
name: Deploy to AWS
on: [push]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm run build
      - run: npm run test
      - uses: aws-actions/configure-aws-credentials@v2
        with:
          role-to-assume: arn:aws:iam::ACCOUNT:role/GitHubRole
      - run: aws s3 sync dist/ s3://my-bucket/
\`\`\`

**Pipeline stages:**
1. Lint (2 min)
2. Unit tests (5 min)
3. Build (3 min)
4. Integration tests (10 min)
5. Deploy to staging
6. Smoke tests
7. Deploy to production

Decision: Use GitHub Actions if already on GitHub. Added benefit: can use with Vercel, AWS, etc.

Learning: Deployment speed matters. Optimize slow steps first (usually tests).`,
      },
    ],
    createdAt: new Date("2026-09-25"),
    updatedAt: new Date("2026-09-25"),
    tags: ["devops", "cicd", "github", "aws"],
  },

  {
    id: "conv-kiro-features",
    title: "Kiro Development Tools & Features",
    source: "Claude",
    messages: [
      {
        role: "user",
        content:
          "We're using Kiro for development. What are the best features for team productivity?",
      },
      {
        role: "assistant",
        content: `Kiro productivity features:

**1. Multi-agent Orchestration**
\`\`\`typescript
// Coordinate multiple agents for parallel work
orchestrate({
  agents: [
    { name: 'code-review', prompt: '...' },
    { name: 'tests', prompt: '...' },
    { name: 'docs', prompt: '...' },
  ]
});
\`\`\`

**2. Artifact Versioning**
- Automatic version tracking
- Easy rollback
- Publish to share with team

**3. Decision: Use Kiro for**
- Code reviews (catches bugs early)
- Test generation
- Documentation
- Architecture planning
- Code refactoring

**4. Key Learning: Kiro + Claude Opus**
- Opus 5.5 has 128K output tokens
- Use for long-form code generation
- Perfect for full project scaffolding

Tip: Combine Kiro with your CI/CD for automated code quality gates.`,
      },
    ],
    createdAt: new Date("2026-09-20"),
    updatedAt: new Date("2026-09-20"),
    tags: ["kiro", "development", "productivity"],
  },
];
