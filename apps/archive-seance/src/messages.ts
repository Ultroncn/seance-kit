import { defineMessages, plural } from "@seance/ui";

/** Every string AI Memory Bank shows. Sample conversations stay in English: they are data. */
export const archiveMessages = defineMessages(
  {
    appTitle: "AI Dev Workflow",
    commands: "Commands",
    settings: "Settings",
    importBusy: "An import is still running. Try again when it finishes.",
    autoImport: {
      menu: "One-click import…",
      menuFiles: "Import files…",
      title: "One-click import",
      intro: "Pick an AI tool, then choose the folder that holds its data. Matching files are imported.",
      pick: (label: string) => `Choose the folder with your ${label} data`,
      noPicker: "This browser can't open folders. Drag the files into the window instead.",
      noneFound: (label: string) => `No ${label} files were found in that folder.`,
      failed: "That folder couldn't be read.",
      whereToLook: "Places to look:",
      whyTitle: "Why a folder picker:",
      why: "Browsers can't scan your disk by themselves, so you choose the folder.",
      privacyTitle: "Stays on this device:",
      privacy: "Files are read in this browser and never uploaded.",
    },
    groupLibrary: "Library",
    groupAsk: "Ask the agent",
    groupAgent: "Agent",
    groupApp: "App",
    cmdImport: "Import files…",
    cmdSample: "Load the sample archive",
    cmdSearch: "Search conversations",
    cmdShowBanished: "Show archived conversations",
    cmdBack: "Back to the library",
    cmdNew: "New session",
    cmdSettings: "Open settings",
    tryDrop: "Want to try the drag-and-drop?",
    downloadSample: "Download a sample export",
    period: ".",
    pickTitle: "Pick a conversation",
    pickText: "Choose one from the library, or ask the agent on the right.",
    dropTitle: "Drop to import",
    dropText: "AI chat exports (Claude, ChatGPT, etc.), .zip or .json formats. Files stay in this browser.",
    emptyTitle: "Your memory bank is empty",
    importExport: "Import your AI chats…",
    emptyText:
      "Drop ChatGPT, Claude, or other AI chat exports here (.zip or conversations.json). Markdown and text formats work too. Everything stays on your device, never uploaded.",
    library: "Memory Bank",
    all: "All",
    views: "Views",
    banished: "Archived",
    import: "Import",
    searchChats: "Search conversations",
    searchPlaceholder: "Search by topic, code, decision…  /",
    source: "Source",
    allSources: "All sources",
    clear: "Clear",
    from: "From",
    to: "to",
    date: "Date",
    dateSet: "Dates set",
    dateRange: "Date range",
    importing: (done: number, total: number) => `Importing ${done} of ${total}…`,
    importCounts: (added: number, updated: number, unchanged: number) =>
      `${added} new ${plural(added, "conversation", "conversations")}, ${updated} updated, ${unchanged} already here.`,
    keptNewer: (n: number) => ` Kept the newer copy of ${n} ${plural(n, "conversation", "conversations")}.`,
    skipped: (n: number) => `Skipped ${n} ${plural(n, "item", "items")}`,
    indexFile: "Search index",
    indexNotSaved: (reason: string) => `Could not be saved: ${reason}`,
    dismiss: "Dismiss",
    loading: "Loading…",
    restoreAll: "Restore all",
    banishedChats: "Archived conversations",
    chatsList: "Conversations",
    hasSummary: "Has insights extracted",
    summarized: "analyzed",
    nothingBanished: "Nothing is archived.",
    noChats: "No conversations yet.",
    noMatch: "No conversations match.",
    showMore: (n: number, rest: number) => `Show ${n} more of ${rest}`,
    backToLibrary: "← Back to library",
    restoredN: (n: number) => `Restored ${n} ${plural(n, "conversation", "conversations")}.`,
    assistant: "AI",
    you: "You",
    messages: (n: number) => `${n} ${plural(n, "message", "messages")}`,
    banishedToast: (title: string) => `Archived "${title}".`,
    undo: "Undo",
    restoredOne: (title: string) => `Restored "${title}".`,
    resurrectReady: "Context ready to continue this conversation elsewhere.",
    banishedNote: "This conversation is archived. It is hidden from the library and search.",
    restore: "Restore",
    resurrect: "Continue elsewhere",
    resurrectTip: "Generate a prompt to continue this conversation in another AI tool.",
    copyMarkdown: "Copy as Markdown",
    copiedMarkdown: "Copied as Markdown.",
    banish: "Archive",
    banishTip: "Hide from the library and search. You can restore it anytime.",
    summaryAndTags: "Insights and tags",
    summary: "Key insights",
    byDemo: " · sample data",
    resurrectionPrompt: "Continuation prompt",
    copy: "Copy",
    promptCopied: "Prompt copied. Paste it into any chat app.",
    messagesList: "Messages",
    approveBanish: (n: number) => `Archive ${n} ${plural(n, "conversation", "conversations")}. You can restore anytime.`,
    approveSummary: (title: string) => `Save insights for "${title}":`,
    approveTags: (title: string) => `Change tags on "${title}".`,
    tagsAdd: "Add:",
    tagsRemove: "Remove:",
    approveResurrect: (title: string) =>
      `Generate a continuation prompt for "${title}":`,
    noteAdded: "Note added to the prompt:",
    describeChat: (title: string, month: string, n: number) =>
      `${title} (${month}, ${n} ${plural(n, "message", "messages")})`,
    agentEmptyTitle: "Analyze your conversations",
    agentEmptyText:
      "Extract code reviews, identify architecture decisions, and generate GitHub issues from your AI conversations. Automate your development workflow.",
    promptLabel: "Analyze conversation",
    placeholder: "Review code? Extract decisions? Generate tasks…",
    placeholderNoData: "Load or import conversations first",
    toolLabels: {
      undo_banish: "Undo archive",
      search_conversations: "Search conversations",
      read_conversation: "Read conversation",
      extract_insights: "Code Review",
      find_related_conversations: "Decision Log",
      build_knowledge_graph: "Generate Issues",
      summarize_conversation: "Save summary",
      tag_conversation: "Add tags",
      banish_conversation: "Archive",
      resurrect_conversation: "Continue elsewhere",
    } as Record<string, string>,
  },
  {
    appTitle: "AI 开发工作流",
    commands: "命令",
    settings: "设置",
    importBusy: "还有导入在进行，请等它完成后再试。",
    autoImport: {
      menu: "一键导入…",
      menuFiles: "导入文件…",
      title: "一键导入",
      intro: "选择一个 AI 工具，再选中存放它数据的文件夹，符合的文件会被导入。",
      pick: (label: string) => `选择存放 ${label} 数据的文件夹`,
      noPicker: "这个浏览器不支持选择文件夹，请把文件直接拖进窗口。",
      noneFound: (label: string) => `在这个文件夹里没有找到 ${label} 的文件。`,
      failed: "无法读取这个文件夹。",
      whereToLook: "可以在这些位置找找：",
      whyTitle: "为什么要选文件夹：",
      why: "浏览器不能自己扫描磁盘，所以需要你选中文件夹。",
      privacyTitle: "只在本机处理：",
      privacy: "文件只在本浏览器里读取，不会上传。",
    },
    groupLibrary: "资料库",
    groupAsk: "问 Agent",
    groupAgent: "Agent",
    groupApp: "应用",
    cmdImport: "导入文件…",
    cmdSample: "加载示例数据",
    cmdSearch: "搜索对话",
    cmdShowBanished: "查看已存档的对话",
    cmdBack: "返回资料库",
    cmdNew: "新会话",
    cmdSettings: "打开设置",
    tryDrop: "想试试拖放导入？",
    downloadSample: "下载一份示例导出文件",
    period: "。",
    pickTitle: "选择一段对话",
    pickText: "从左侧资料库选一段，或者在右侧问 Agent。",
    dropTitle: "松开即可导入",
    dropText: "支持 Claude、ChatGPT 等 AI 工具的导出（.zip 或 .json）。文件只留在本浏览器中。",
    emptyTitle: "你的记忆库还是空的",
    importExport: "导入你的 AI 对话…",
    emptyText:
      "把 Claude、ChatGPT 或其他 AI 工具的导出文件拖到这里（.zip 或 conversations.json）。Markdown 和纯文本格式也支持。所有内容都只留在本设备中。",
    library: "记忆库",
    all: "全部",
    views: "视图",
    banished: "已存档",
    import: "导入",
    searchChats: "搜索对话",
    searchPlaceholder: "按主题、代码、决策搜索…  /",
    source: "来源",
    allSources: "全部来源",
    clear: "清除",
    from: "从",
    to: "到",
    date: "日期",
    dateSet: "已设日期",
    dateRange: "日期范围",
    importing: (done: number, total: number) => `正在导入 ${done} / ${total}…`,
    importCounts: (added: number, updated: number, unchanged: number) =>
      `新增 ${added} 个对话，更新 ${updated} 个，${unchanged} 个已存在。`,
    keptNewer: (n: number) => `有 ${n} 个对话保留了较新的版本。`,
    skipped: (n: number) => `跳过了 ${n} 项`,
    indexFile: "搜索索引",
    indexNotSaved: (reason: string) => `无法保存：${reason}`,
    dismiss: "关闭",
    loading: "加载中…",
    restoreAll: "全部恢复",
    banishedChats: "已存档的对话",
    chatsList: "对话",
    hasSummary: "已提取要点",
    summarized: "已分析",
    nothingBanished: "没有被存档的对话。",
    noChats: "还没有对话。",
    noMatch: "没有匹配的对话。",
    showMore: (n: number, rest: number) => `再显示 ${n} 个（还剩 ${rest} 个）`,
    backToLibrary: "← 返回资料库",
    restoredN: (n: number) => `已恢复 ${n} 个对话。`,
    assistant: "AI",
    you: "你",
    messages: (n: number) => `${n} 条消息`,
    banishedToast: (title: string) => `已存档"${title}"。`,
    undo: "撤销",
    restoredOne: (title: string) => `已恢复"${title}"。`,
    resurrectReady: "续接提示词已生成，可以复制到任意聊天应用中。",
    banishedNote: "这段对话已被存档，不会出现在资料库和搜索结果中。",
    restore: "恢复",
    resurrect: "在其他工具中继续",
    resurrectTip: "生成一段带上下文的提示词，让这段对话在其他 AI 工具里接着聊。",
    copyMarkdown: "复制为 Markdown",
    copiedMarkdown: "已复制为 Markdown。",
    banish: "存档",
    banishTip: "从资料库和搜索中隐藏。不会删除任何内容，可以随时恢复。",
    summaryAndTags: "要点和标签",
    summary: "关键洞察",
    byDemo: " · 示例数据",
    resurrectionPrompt: "续接提示词",
    copy: "复制",
    promptCopied: "提示词已复制。粘贴到任意聊天应用中继续。",
    messagesList: "消息",
    approveBanish: (n: number) => `存档 ${n} 个对话。你可以随时恢复。`,
    approveSummary: (title: string) => `为"${title}"保存要点：`,
    approveTags: (title: string) => `修改"${title}"的标签。`,
    tagsAdd: "添加：",
    tagsRemove: "移除：",
    approveResurrect: (title: string) =>
      `为"${title}"生成续接提示词：`,
    noteAdded: "已添加到提示词：",
    describeChat: (title: string, month: string, n: number) =>
      `${title} (${month}, ${n} 条消息)`,
    agentEmptyTitle: "分析你的对话",
    agentEmptyText:
      "从 AI 对话自动提取代码审查、架构决策和 GitHub issues。自动化你的开发工作流。",
    promptLabel: "分析对话",
    placeholder: "审查代码？提取决策？生成任务…",
    placeholderNoData: "先导入或加载一些对话",
    toolLabels: {
      undo_banish: "撤销存档",
      search_conversations: "搜索对话",
      read_conversation: "阅读对话",
      extract_insights: "代码审查",
      find_related_conversations: "决策日志",
      build_knowledge_graph: "生成任务",
      summarize_conversation: "保存摘要",
      tag_conversation: "添加标签",
      banish_conversation: "存档",
      resurrect_conversation: "在其他工具继续",
    } as Record<string, string>,
  },
);

/** Scripted demo replies. Read at reply time, so they follow the language switch. */
export const archiveDemoMessages = defineMessages(
  {
    prompts: {
      codeReview: "Review the React optimization code for issues",
      decisions: "Extract architecture decisions from the database conversation",
      tasks: "Generate GitHub issues from the API design discussion",
    },
    unknown:
      "Demo mode only understands a few scripted prompts. Pick one of the suggestions, or switch to a real provider in Settings.",
    empty: "I couldn't find matching conversations. Load the sample archive or import an export first.",
    and: " and ",
    sentenceGap: " ",
    lookingOldest: "Analyzing conversation...",
    reading: (titles: string) => `Reviewing ${titles}...`,
    summariesWait: "Here are the analysis results.",
    savedSummaries: (titles: string) => `Saved analysis for ${titles}.`,
    quoteOnly:
      "Demo mode shows sample results. A real workflow would process the full conversation.",
    rejectedSummaries: (n: number) =>
      `You dismissed ${n === 1 ? "one result" : `${n} results`}.`,
    nothingSaved: "Nothing was saved.",
    foundTagging: (n: number) =>
      `Found ${n === 1 ? "one issue" : `${n} issues`}.`,
    tagged: (titles: string) => `Tagged ${titles}.`,
    noTags: "No changes made.",
    noTests: "No issues to report.",
    looksLikeTests: (titles: string) => `Reviewing ${titles}.`,
    leftAlone: "Okay, left as is.",
    banishedDone: (titles: string) =>
      `Archived ${titles}.`,
    foundFrom: (title: string, month: string) => `Found "${title}" from ${month}.`,
    resurrectNote: "",
    isBack: (title: string) =>
      `"${title}" restored.`,
    notResurrected: "Not restored.",
    youAsked: (title: string, month: string, asks: string) =>
      `In "${title}" (${month}):\n${asks}`,
    extractInsightsResult: `## Code Review Results

**Found 5 Code Issues:**

1. [CRITICAL] Security Risk - innerHTML usage
   - Using innerHTML could expose to XSS attacks
   - Suggestion: Use textContent or createElement instead

2. [WARNING] Performance - Nested loops detected
   - Two nested loops could cause N² complexity
   - Suggestion: Consider using a Map/Set for O(1) lookups

3. [WARNING] Missing Error Handling
   - fetch() call without try-catch
   - Suggestion: Wrap in try-catch block

4. [INFO] TypeScript - Type annotation missing
   - Variable 'data' lacks explicit type
   - Suggestion: Add type annotation

5. [INFO] Best Practice - No input validation
   - User input not sanitized
   - Suggestion: Add validation before processing`,
    relatedResult: `## Architecture Decisions Extracted

**Key Decisions (3 found):**

1. [ARCHITECTURE] Use REST over GraphQL
   - Impact: HIGH
   - Rationale: Simpler caching strategy, better performance at scale

2. [TECHNOLOGY] Vite for build tool instead of Webpack
   - Impact: MEDIUM
   - Rationale: Faster dev experience, better HMR support

3. [PROCESS] Implement code review before merge
   - Impact: HIGH
   - Rationale: Catch issues early, improve code quality

**Identified Risks (2 found):**

1. [HIGH] N+1 Query Problem in database layer
   - Mitigation: Use JOIN queries or batch loading

2. [MEDIUM] Performance bottleneck with large datasets
   - Mitigation: Implement pagination and virtualization`,
    graphResult: `## Generated GitHub Issues (4 created)

### 1. Fix: XSS vulnerability in user input handling
- Priority: P0 (Critical)
- Labels: security, bug, from-ai-discussion
- Description: Review innerHTML usage and replace with safer alternatives

### 2. Optimize: Nested loop query performance
- Priority: P1
- Labels: performance, optimization, from-ai-discussion
- Description: Refactor double loop to use hash-based lookup

### 3. Implement: Error handling for API calls
- Priority: P1
- Labels: robustness, from-ai-discussion
- Description: Add comprehensive try-catch and error logging

### 4. Refactor: Database query pattern
- Priority: P2
- Labels: refactor, database, from-ai-discussion
- Description: Replace N+1 queries with proper JOINs`,
    summaries: {
      "React Performance Optimization": "High-level discussion on code splitting, memoization, and virtualization strategies.",
      "API Design": "REST vs GraphQL analysis, caching strategies, handling high-traffic scenarios.",
    } as Record<string, string>,
  },
  {
    prompts: {
      codeReview: "审查 React 优化代码的问题",
      decisions: "从数据库对话中提取架构决策",
      tasks: "从 API 设计讨论生成 GitHub issues",
    },
    unknown: "演示模式只认得几条预设的提问。请从推荐提问里选一条，或者在设置里换成真实模型。",
    empty: "没找到相关的对话。请先加载示例存档，或者导入一份导出文件。",
    and: "和",
    sentenceGap: "",
    lookingOldest: "正在分析对话。",
    reading: (titles: string) => `正在审查${titles}。`,
    summariesWait: "这是分析结果。",
    savedSummaries: (titles: string) => `已为${titles}保存分析。`,
    quoteOnly: "演示模式展示的是示例结果。真实工作流会处理完整对话。",
    rejectedSummaries: (n: number) => `你驳回了 ${n} 个结果。`,
    nothingSaved: "没有保存任何内容。",
    foundTagging: (n: number) => `找到 ${n} 个问题。`,
    tagged: (titles: string) => `已为${titles}打标签。`,
    noTags: "没有改动。",
    noTests: "没有问题需要报告。",
    looksLikeTests: (titles: string) => `正在审查${titles}。`,
    leftAlone: "好的，保持原样。",
    banishedDone: (titles: string) =>
      `已存档${titles}。`,
    foundFrom: (title: string, month: string) => `找到 ${month} 的"${title}"。`,
    resurrectNote: "",
    isBack: (title: string) =>
      `"${title}"已恢复。`,
    notResurrected: "未恢复。",
    youAsked: (title: string, month: string, asks: string) =>
      `在"${title}"（${month}）中：\n${asks}`,
    extractInsightsResult: `## 代码审查结果

**发现 5 个代码问题：**

1. [严重] 安全风险 - innerHTML 使用
   - 使用 innerHTML 容易导致 XSS 攻击
   - 建议：用 textContent 或 createElement 替代

2. [警告] 性能 - 检测到嵌套循环
   - 两个嵌套循环可能导致 N² 复杂度
   - 建议：考虑用 Map/Set 实现 O(1) 查找

3. [警告] 缺少错误处理
   - fetch() 调用没有 try-catch
   - 建议：用 try-catch 包裹

4. [信息] TypeScript - 缺少类型注解
   - 变量 'data' 没有明确类型
   - 建议：添加类型注解

5. [信息] 最佳实践 - 无输入验证
   - 用户输入未清理
   - 建议：处理前验证`,
    relatedResult: `## 提取的架构决策

**关键决策（3 个）：**

1. [架构] 选择 REST 而非 GraphQL
   - 影响：HIGH
   - 理由：缓存策略更简单，大规模性能更好

2. [技术] 用 Vite 而非 Webpack
   - 影响：MEDIUM
   - 理由：更快的开发体验，更好的 HMR 支持

3. [流程] 合并前进行代码审查
   - 影响：HIGH
   - 理由：提前发现问题，提升代码质量

**识别的风险（2 个）：**

1. [HIGH] 数据库层的 N+1 查询问题
   - 缓解措施：使用 JOIN 查询或批量加载

2. [MEDIUM] 大数据集性能瓶颈
   - 缓解措施：实现分页和虚拟化`,
    graphResult: `## 生成的 GitHub Issues（4 个）

### 1. 修复：用户输入的 XSS 漏洞
- 优先级：P0（严重）
- 标签：security, bug, from-ai-discussion
- 描述：审查 innerHTML 使用情况，用更安全的方式替代

### 2. 优化：嵌套循环查询性能
- 优先级：P1
- 标签：performance, optimization, from-ai-discussion
- 描述：重构双循环为哈希查找

### 3. 实现：API 调用的错误处理
- 优先级：P1
- 标签：robustness, from-ai-discussion
- 描述：添加全面的 try-catch 和错误日志

### 4. 重构：数据库查询模式
- 优先级：P2
- 标签：refactor, database, from-ai-discussion
- 描述：用适当的 JOIN 替代 N+1 查询`,
    summaries: {
      "React Performance Optimization": "关于代码分割、记忆化和虚拟化策略的高层讨论。",
      "API Design": "REST vs GraphQL 分析、缓存策略、高流量处理。",
    },
  },
);
