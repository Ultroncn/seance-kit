import { ToolRegistry, undoBanishTool } from "@seance/core";
import { banishEmails } from "./banish_emails";
import { classifyEmails } from "./classify_emails";
import { draftReply } from "./draft_reply";
import { labelEmail } from "./label_email";
import { readEmail } from "./read_email";
import { searchEmails } from "./search_emails";
import type { InboxDeps } from "./shared";

export type { InboxDeps } from "./shared";
export { replySubject } from "./draft_reply";

/** Every Inbox Exorcist tool. None of them can send mail. */
export function createInboxRegistry(deps: InboxDeps): ToolRegistry {
  return new ToolRegistry()
    .register(searchEmails(deps))
    .register(readEmail())
    .register(classifyEmails(deps))
    .register(draftReply())
    .register(labelEmail(deps))
    .register(banishEmails())
    .register(undoBanishTool());
}

export const INBOX_TOOL_LABELS: Record<string, string> = {
  undo_banish: "Undo a banish",
  search_emails: "Search mail",
  read_email: "Read an email",
  classify_emails: "Sort into categories",
  draft_reply: "Draft a reply",
  label_email: "Change labels",
  banish_emails: "Hide emails",
};

export const INBOX_SYSTEM_PROMPT = `You are the agent inside Inbox Exorcist, a local-first app holding an imported email archive (.mbox or .eml).
You can search, read, classify, label, draft replies and hide (banish) mail. You can never send email.
Rules:
- Find mail with search_emails before acting on it. Never invent ids.
- Categories: needs-reply (someone is waiting for an answer), personal, receipt (orders, bookings, invoices), notification (automatic updates), newsletter (subscriptions, promotions), noise (nothing useful).
- Classify in batches with classify_emails. The user approves each batch.
- Read an email before drafting a reply. Drafts are short, friendly and in the user's voice. Say that the draft is saved and not sent.
- Banish only what the user asked for. It hides mail in this app and can be undone.
- If the user rejects an action, accept it and do not retry it.
- Keep replies short and name the emails you touched.`;
