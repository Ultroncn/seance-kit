import { defineMessages } from "@seance/ui";

// Step 5 (optional): every string the app shows, in English and Chinese. `tsc` fails if the two
// dictionaries drift apart. Delete the zh half's contents and copy English if you only need one.
export const messages = defineMessages(
  {
    commands: "Commands",
    settings: "Settings",
    notes: "Notes",
    contentTitle: "Your app goes here",
    contentText: "Replace this pane with your own view of the data.",
    openSettings: "Open settings",
    groupApp: "App",
    emptyTitle: "Ask your notebook",
    emptyText: "The agent can search, add and hide notes. It asks before changing anything.",
    promptLabel: "Ask your notebook",
    placeholder: "Ask about your notes…",
    toolLabels: {
      search_notes: "Search notes",
      add_note: "Add a note",
      banish_notes: "Hide notes",
    } as Record<string, string>,
  },
  {
    commands: "命令",
    settings: "设置",
    notes: "笔记",
    contentTitle: "这里放你的应用",
    contentText: "把这个面板换成你自己的数据视图。",
    openSettings: "打开设置",
    groupApp: "应用",
    emptyTitle: "问问你的笔记本",
    emptyText: "Agent 可以搜索、添加和隐藏笔记。修改任何内容之前都会先征求你的同意。",
    promptLabel: "向笔记本提问",
    placeholder: "问点关于你的笔记的问题…",
    toolLabels: {
      search_notes: "搜索笔记",
      add_note: "添加笔记",
      banish_notes: "隐藏笔记",
    },
  },
);

/** Scripted demo wording. Read at reply time, so it follows the language switch. */
export const demoMessages = defineMessages(
  {
    prompts: { add: "Note that the séance is on Friday", tidy: "Hide my notes about Friday" },
    saved: "Saved “Séance on Friday”.",
    none: "There are no notes about Friday.",
    hiding: "Hiding them. You can undo it.",
    done: "Done.",
    kept: "Okay, I kept them.",
    unknown:
      "Demo mode only knows the suggested prompts. Add a key in Settings to use a real model.",
  },
  {
    prompts: { add: "记一下：降灵会在周五", tidy: "隐藏关于周五的笔记" },
    saved: "已保存“Séance on Friday”。",
    none: "没有关于周五的笔记。",
    hiding: "正在隐藏，可以撤销。",
    done: "完成。",
    kept: "好的，我保留了它们。",
    unknown: "演示模式只认得推荐的提问。在设置里填入 key 即可使用真实模型。",
  },
);
