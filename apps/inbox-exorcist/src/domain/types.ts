import type { StoredItem } from "@seance/storage";

export const EMAILS = "emails";
export const DRAFTS = "drafts";

export const CATEGORIES = [
  "needs-reply",
  "personal",
  "receipt",
  "notification",
  "newsletter",
  "noise",
] as const;
export type Category = (typeof CATEGORIES)[number];
export const CATEGORY_LABEL: Record<Category, string> = {
  "needs-reply": "Needs reply",
  personal: "Personal",
  receipt: "Receipt",
  notification: "Notification",
  newsletter: "Newsletter",
  noise: "Noise",
};

export interface Address {
  name: string;
  address: string;
}

/** What the importer produces, after `normalizeEmail`. */
export interface NormalizedEmail {
  /** Message-ID without angle brackets, or null when the message has none. */
  messageId: string | null;
  from: Address;
  to: Address[];
  cc: Address[];
  /** Where replies should go, when the sender set Reply-To. */
  replyTo: Address[];
  subject: string;
  date: string;
  /** Plain text body. HTML-only mail is converted to text. */
  text: string;
  attachments: number;
}

/** A stored email: imported content plus what the user and agent added. */
export interface Email extends NormalizedEmail, StoredItem {
  id: string;
  rev: number;
  labels: string[];
  category?: Category;
  categorizedAt?: string;
  banishedAt?: string;
  banishToken?: string;
}

/** A reply the agent or user wrote. Drafts are text only: nothing is ever sent. */
export interface Draft extends StoredItem {
  id: string;
  emailId: string;
  to: string;
  subject: string;
  body: string;
  createdAt: string;
}
