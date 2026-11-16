import { defineMessages, plural } from "./i18n";

/** Every string the shared UI kit shows. Apps keep their own dictionaries next to their code. */
export const kitMessages = defineMessages(
  {
    skipToContent: "Skip to content",
    home: "Séance Kit home",
    library: "Library",
    content: "Content",
    agent: "Agent",
    language: "Language",

    // Timeline
    agentRun: "Agent run",
    you: "You",
    input: "Input",
    output: "Output",
    undo: "Undo",
    restored: "Restored",
    risk: { read: "reads", write: "writes", destructive: "hides" },
    status: {
      running: "Running",
      awaiting_approval: "Waiting for you",
      rejected: "Rejected",
      done: "Done",
      failed: "Failed",
    },
    announceReply: (text: string) => `Agent: ${text}`,
    announceWaiting: (name: string) => `Waiting for your approval: ${name}`,
    announceRunning: (name: string) => `Running ${name}`,
    notice: {
      Aborted: "Run cancelled",
      StepBudget: "The agent reached its step limit.",
    } as Record<string, string>,

    // Approval card
    allow: "Allow",
    question: "?",
    reject: "Reject",
    escRejects: "Esc rejects",
    exactInput: "Exact input",
    details: "Details",
    approvalWrite: "This changes your saved data.",
    approvalDestructive: "This hides items. Nothing is deleted, and you can undo it.",

    // Palette
    commandPalette: "Command palette",
    commands: "Commands",
    paletteSearch: "Type a command or search…",
    paletteEmpty: "Nothing matches. Try a plainer word.",

    // Demo badge
    demoMode: "Demo mode",
    demoTooltip:
      "Replies are scripted, not from a real model. Add your own key in Settings to use one.",
    demoSr: ": replies are scripted. Open settings to use a real model.",

    // Agent panel
    seance: "Séance",
    newSeance: "New séance",
    suggested: "Suggested prompts",
    demoNote:
      "Demo mode scripts these prompts. The tools, approvals and changes are real and run on your data.",
    stop: "Stop",
    send: "Send",

    // Settings
    settings: "Settings",
    settingsIntro: "Everything here is stored only in this browser.",
    provider: "Model provider",
    choice: {
      demo: {
        label: "Demo (scripted)",
        note: "No key needed. Replies are scripted and the Demo-mode badge stays on.",
      },
      anthropic: {
        label: "Anthropic",
        note: "Your browser calls api.anthropic.com directly with your key.",
      },
      "openai-compatible": {
        label: "OpenAI-compatible",
        note: "OpenAI or any server with the same API. It must allow requests from this page (CORS).",
      },
      ollama: {
        label: "Ollama (local)",
        note: "Runs on your machine. Start Ollama with OLLAMA_ORIGINS set to this site's address.",
      },
    },
    baseUrl: "Base URL",
    apiKey: "API key",
    apiKeyHint:
      "Saved in this browser's IndexedDB. Sent only to the provider above. Never exported.",
    host: "Host",
    hostHint: "Leave empty for http://localhost:11434.",
    model: "Model",
    modelHint: "The exact model name your provider lists.",
    save: "Save",
    testConnection: "Test connection",
    nowDemo: "Now: demo mode",
    nowReal: "Now: real model",
    yourData: "Your data",
    exportAll: "Export all data",
    deleteAll: "Delete all local data…",
    deleteWarning:
      "This permanently deletes everything this app stored in this browser, including your saved key. Export first if you want a copy.",
    deleteEverything: "Delete everything",
    cancel: "Cancel",
    closeSettings: "Close settings",
    errKey: "Enter your API key.",
    errModel: "Enter a model name.",
    errBaseUrl: "Enter a base URL starting with https:// (http:// only for localhost).",
    errHost: "Enter a host URL such as http://localhost:11434.",
    errPickReal: "Pick a real provider to test.",
    savedUnusable: (reason: string) => `Saved settings could not be used: ${reason}`,
    savedDemo: "Back in demo mode. Your key was removed.",
    savedReal: "Saved. The agent now uses this model.",
    testing: "Testing…",
    connected: (said: string) => `Connected. The model replied: ${said}`,
    emptyReply: "(empty reply)",
    exported: "Export downloaded. It does not include your API key.",
    wiped: "All local data was deleted.",

    // Shared helpers apps can use
    count: (n: number, one: string, many: string) => `${n} ${plural(n, one, many)}`,
  },
  {
    skipToContent: "跳到正文",
    home: "Séance Kit 首页",
    library: "资料库",
    content: "内容",
    agent: "Agent",
    language: "语言",

    agentRun: "Agent 运行记录",
    you: "你",
    input: "输入",
    output: "输出",
    undo: "撤销",
    restored: "已恢复",
    risk: { read: "只读", write: "写入", destructive: "隐藏" },
    status: {
      running: "运行中",
      awaiting_approval: "等你确认",
      rejected: "已拒绝",
      done: "完成",
      failed: "失败",
    },
    announceReply: (text: string) => `Agent：${text}`,
    announceWaiting: (name: string) => `等待你批准：${name}`,
    announceRunning: (name: string) => `正在运行：${name}`,
    notice: {
      Aborted: "已停止运行",
      StepBudget: "Agent 已达到步数上限。",
    } as Record<string, string>,

    allow: "允许",
    question: "？",
    reject: "拒绝",
    escRejects: "按 Esc 拒绝",
    exactInput: "完整输入",
    details: "详情",
    approvalWrite: "这会修改你保存的数据。",
    approvalDestructive: "这会隐藏条目。不会删除任何东西，而且可以撤销。",

    commandPalette: "命令面板",
    commands: "命令",
    paletteSearch: "输入命令或搜索…",
    paletteEmpty: "没有匹配的命令，换个更简单的词试试。",

    demoMode: "演示模式",
    demoTooltip:
      "回复是预先写好的脚本，不来自真实模型。在设置里填入你自己的 key 即可使用真实模型。",
    demoSr: "：回复是脚本生成的。打开设置可以改用真实模型。",

    seance: "降灵",
    newSeance: "新的降灵",
    suggested: "推荐提问",
    demoNote:
      "演示模式下，这些提问的回复是脚本写好的。但工具、审批和数据改动都是真实的，作用在你的数据上。",
    stop: "停止",
    send: "发送",

    settings: "设置",
    settingsIntro: "这里的所有内容只保存在当前浏览器中。",
    provider: "模型提供方",
    choice: {
      demo: { label: "演示（脚本）", note: "不需要 key。回复由脚本生成，演示模式标记会一直显示。" },
      anthropic: { label: "Anthropic", note: "浏览器直接用你的 key 调用 api.anthropic.com。" },
      "openai-compatible": {
        label: "OpenAI 兼容",
        note: "OpenAI 或任何提供相同 API 的服务器。它必须允许来自本页面的请求（CORS）。",
      },
      ollama: {
        label: "Ollama（本地）",
        note: "在你自己的电脑上运行。启动 Ollama 时，把 OLLAMA_ORIGINS 设为本站地址。",
      },
    },
    baseUrl: "Base URL",
    apiKey: "API key",
    apiKeyHint: "保存在本浏览器的 IndexedDB 中，只发送给上面选择的提供方，导出时永远不包含。",
    host: "主机地址",
    hostHint: "留空则使用 http://localhost:11434。",
    model: "模型",
    modelHint: "填写提供方列出的准确模型名。",
    save: "保存",
    testConnection: "测试连接",
    nowDemo: "当前：演示模式",
    nowReal: "当前：真实模型",
    yourData: "你的数据",
    exportAll: "导出全部数据",
    deleteAll: "删除所有本地数据…",
    deleteWarning:
      "这会永久删除本应用在此浏览器中保存的所有内容，包括你保存的 key。如需备份，请先导出。",
    deleteEverything: "全部删除",
    cancel: "取消",
    closeSettings: "关闭设置",
    errKey: "请填写你的 API key。",
    errModel: "请填写模型名。",
    errBaseUrl: "请填写以 https:// 开头的 Base URL（只有 localhost 可以用 http://）。",
    errHost: "请填写主机地址，例如 http://localhost:11434。",
    errPickReal: "请先选择一个真实的提供方再测试。",
    savedUnusable: (reason: string) => `保存的设置无法使用：${reason}`,
    savedDemo: "已切回演示模式，你的 key 已删除。",
    savedReal: "已保存。Agent 现在使用这个模型。",
    testing: "测试中…",
    connected: (said: string) => `连接成功。模型回复：${said}`,
    emptyReply: "（空回复）",
    exported: "已下载导出文件，其中不包含你的 API key。",
    wiped: "所有本地数据已删除。",

    count: (n: number, one: string, many: string) => `${n} ${plural(n, one, many)}`,
  },
);
