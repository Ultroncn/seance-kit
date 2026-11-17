# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

Séance Kit 是一个本地优先的 AI agent 应用模板，附带两个示范应用。这是一个 pnpm monorepo，包含可复用的 agent 核心、存储层、UI 组件库和 MCP 服务器。

- **Archive Séance** (`apps/archive-seance`): AI 聊天记录归档和搜索
- **Inbox Exorcist** (`apps/inbox-exorcist`): 邮件归档分类处理
- **核心包** (`packages/`): core（agent 循环）、llm（提供商）、storage（存储）、ui（组件）、mcp-server

## 常用命令

```bash
# 安装和开发
pnpm install                                    # 安装所有依赖
pnpm --filter @seance/archive-seance dev        # 开发 Archive Séance
pnpm --filter @seance/inbox-exorcist dev        # 开发 Inbox Exorcist
pnpm --filter @seance/site dev                  # 开发落地页

# 构建和验证
pnpm build                                      # 构建所有项目到 dist/
pnpm typecheck                                  # 全项目类型检查
pnpm lint                                       # ESLint 检查
pnpm format                                     # Prettier 格式化

# 测试
pnpm test                                       # 运行所有单元测试（Vitest）
pnpm test -- packages/core                      # 测试特定包
pnpm e2e                                        # Playwright E2E + axe 可访问性测试

# 创建新应用
pnpm new:app recipe-ghost                       # 从模板创建新应用
pnpm install                                    # 重新安装以链接新应用

# MCP 服务器（用于 Kiro）
pnpm --filter @seance/archive-seance mcp -- --data .local-data/archive --import <file>
```

## 核心架构

### 1. Agent 循环 (`packages/core`)

Agent 类是核心：一个实例管理一个对话会话。

- **输入**：Provider、ToolRegistry、Storage、system prompt
- **输出**：类型化的事件流（AgentEvent）
- **约束**：
  - 强制执行 `maxSteps` 预算（默认 8），property-tested
  - 风险为 `write` 或 `destructive` 的工具必须经过审批才能执行
  - 工具输入在执行前通过 zod schema 验证，无效输入作为错误返回给模型
  - 每个工具调用 ID 唯一，每次调用恰好有一个结果

**事件类型**：`run_started`、`step_started`、`message`、`message_delta`、`reasoning_delta`、`tool_called`、`approval_requested`、`approval_resolved`、`tool_result`、`error`、`run_finished`

### 2. 工具注册 (`packages/core/src/registry.ts`)

每个工具必须提供：
- zod 输入 schema
- zod 输出 schema
- 描述（用于 LLM 和 MCP）
- 风险级别：`read`（自动批准）、`write`（需审批）、`destructive`（需审批，返回 undoToken）

工具定义方式：一个应用的所有工具放在 `apps/<name>/src/tools/`，每个工具一个文件，在 `tools/index.ts` 注册。ToolRegistry 自动生成：
- 供 LLM 使用的 JSON Schema
- 供 Kiro 使用的 MCP tool definitions
- 运行时验证和错误处理

### 3. 存储抽象 (`packages/storage`)

`Storage` 接口有三种实现：
- **IndexedDB**（浏览器，使用 Dexie）
- **Memory**（测试）
- **File**（Node.js，用于 MCP）

所有实现通过同一套合约测试（property-based tests with fast-check）。Storage 包含：
- CRUD 操作
- 软删除（banish/unbanish）
- 全文搜索（MiniSearch），索引持久化
- 导入去重（基于 ID 或内容哈希）

### 4. LLM 提供商 (`packages/llm`)

支持的提供商：
- **Anthropic**（streaming）
- **OpenAI 兼容端点**（OpenRouter、DeepSeek、Qwen、Doubao、SiliconFlow 等）
- **Ollama**（本地）
- **Mock**（确定性脚本重放，用于演示和测试）

关键文件：
- `factory.ts`：根据配置创建提供商
- `presets.ts`：预设的提供商配置（包括中国厂商）
- `models.ts` / `reasoning.ts`：模型能力和推理级别映射
- `anthropic-stream.ts` / `openai-stream.ts`：流式响应处理

API 密钥仅存储在浏览器 IndexedDB，不发送到除所选提供商外的任何地方。

### 5. UI 组件库 (`packages/ui`)

共享的暗色主题设计系统：
- **AppShell**：应用外壳，包含侧边栏、设置、命令面板
- **SeanceTimeline**：显示 agent 执行流程的时间线，每个工具调用显示输入/输出/耗时/审批状态
- **AgentPanel**：agent 交互面板，包含输入框、模型选择器
- **ApprovalCard**：工具审批 UI
- **CommandPalette**：⌘K 快捷命令
- **ModelPicker**：多提供商模型选择器，带推理级别控制
- **SettingsDialog**：提供商配置、数据导出
- **DemoBadge**：Mock 提供商激活时显示的演示模式徽章
- **tokens.css**：CSS 变量定义主题（中性色 + indigo 强调色）

所有组件支持 `prefers-reduced-motion`，通过 axe 可访问性检查（CI）。

### 6. 国际化

类型安全的 i18n 层（`packages/ui/src/i18n.ts` 和各 app 的 `messages.ts`）：
- 支持英文和中文
- 缺失翻译会产生类型错误
- 无外部依赖，基于简单的 `t()` 函数

### 7. MCP 服务器 (`packages/mcp-server`)

将应用的工具注册表通过 stdio MCP 协议暴露给 Kiro 或其他 MCP 客户端。工具定义与浏览器中相同，无重复。使用文件 Storage 适配器。

Kiro 配置在 `.kiro/settings/mcp.json`，可以用示例数据启动两个应用的 MCP 服务器。

## 开发新应用

1. `pnpm new:app <name>` 从 `templates/app` 复制模板到 `apps/<name>`
2. `pnpm install` 链接新应用
3. 在 `src/tools/shared.ts` 定义数据结构（zod schemas）
4. 在 `src/tools/` 添加工具，每个工具一个文件，包含 input/output schema、风险级别、实现
5. 在 `src/tools/index.ts` 注册所有工具
6. 在 `src/demo/scripts.ts` 编写 2-3 个演示脚本（Mock 提供商使用）
7. 在 `src/App.tsx` 替换内容面板为你的数据视图
8. 保持 `pnpm test` 通过

模板自带工具和脚本的测试。

## 测试策略

- **单元测试**：Vitest，覆盖工具、存储、agent 循环
- **Property-based tests**：fast-check，测试 agent 不变量、存储合约
- **E2E 测试**：Playwright，测试关键用户流程
- **可访问性**：axe-core，CI 中对主要页面运行

测试位置：
- `packages/*/test/` - 包级测试
- `apps/*/src/**/*.test.ts` - 应用内测试
- `e2e/*.spec.ts` - E2E 测试

## 技术栈和约束

- **TypeScript 5.9**（strict 模式）
- **Zod 4.0**（schema 验证）
- **React + Vite**（应用构建）
- **Dexie**（IndexedDB 包装）
- **MiniSearch**（全文搜索）
- **Vitest + fast-check**（测试）
- **Playwright + axe**（E2E + a11y）
- **Node 22.13+（22.x）或 Node 24+，pnpm 9**

约束：
- 暗色主题专用，不支持浅色
- 本地优先，无后端，无账号系统
- 演示模式使用 Mock 提供商，显示 "Demo mode" 徽章
- 所有 destructive 操作都是软删除（banish），支持 undo
- 工具调用需要明确的风险级别和审批流程

## 代码风格

- 使用 ESLint + Prettier，配置在根目录
- 组件文件首字母大写（PascalCase）
- 工具文件小写下划线（snake_case）
- 优先使用函数组件和 hooks
- 类型优先从 `types.ts` 导入
- 避免 `any`，使用 `unknown` 和类型守卫

## 部署

- 目标：Cloudflare Workers 静态资源
- 构建产物在 `dist/`：`/`（落地页）、`/archive/`、`/inbox/`、`/kit/`
- `wrangler.jsonc` 配置部署
- `worker/index.js` 提供 SPA 回退路由

## 重要文件

- `.kiro/` - 规格、设计、任务（Kiro 项目管理）
- `KIRO_USAGE.md` - Kiro 使用文档
- `pnpm-workspace.yaml` - workspace 配置
- `scripts/build-all.mjs` - 构建脚本
- `scripts/new-app.mjs` - 应用生成脚本
