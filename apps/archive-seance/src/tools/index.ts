import { ToolRegistry } from "@seance/core";
import { banishConversation } from "./banish_conversation";
import { readConversation } from "./read_conversation";
import { resurrectConversation } from "./resurrect_conversation";
import { searchConversations } from "./search_conversations";
import type { ArchiveDeps } from "./shared";
import { summarizeConversation } from "./summarize_conversation";
import { tagConversation } from "./tag_conversation";

export type { ArchiveDeps } from "./shared";
export { resurrectionPrompt } from "./resurrect_conversation";

/** Every Archive Séance tool. The browser agent and the MCP server both use this registry. */
export function createArchiveRegistry(deps: ArchiveDeps): ToolRegistry {
  return new ToolRegistry()
    .register(searchConversations(deps))
    .register(readConversation())
    .register(summarizeConversation(deps))
    .register(tagConversation(deps))
    .register(banishConversation())
    .register(resurrectConversation());
}

export const ARCHIVE_TOOL_LABELS: Record<string, string> = {
  search_conversations: "Search chats",
  read_conversation: "Read a chat",
  summarize_conversation: "Save a summary",
  tag_conversation: "Change tags",
  banish_conversation: "Hide chats",
  resurrect_conversation: "Resurrect a chat",
};

export const ARCHIVE_SYSTEM_PROMPT = `You are the agent inside Archive Séance, a local-first app that holds the user's old AI chat exports.
Use the tools to search, read, summarize, tag, hide (banish) and resurrect chats. The data is on the user's device.
Rules:
- Find chats with search_conversations before acting on them. Never invent ids.
- Read a chat before you summarize it. Summaries are two or three plain sentences.
- Tags are short and lower-case.
- Banish only what the user asked for. It hides chats and can be undone.
- The user approves every change. If they reject one, accept it and do not retry the same action.
- Keep replies short. Name the chats you touched.`;
