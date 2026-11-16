import { createAgent, type AgentEvent, type ToolContext } from "@seance/core";
import { MockProvider } from "@seance/llm";
import { MemoryStorage } from "@seance/storage";
import { describe, expect, it } from "vitest";
import { DEMO_PROMPTS, inboxScripts } from "../src/demo/scripts";
import { normalizeEmail } from "../src/domain/normalize";
import { createInboxSearch, importEmails } from "../src/domain/store";
import { DRAFTS, EMAILS, type Draft, type Email } from "../src/domain/types";
import { fileFrom, readEmails, splitMbox } from "../src/importers";
import { createInboxRegistry } from "../src/tools";
import { normalizeLabel } from "../src/tools/shared";

async function seed(emails: Parameters<typeof normalizeEmail>[0][]) {
  const storage = new MemoryStorage();
  const search = createInboxSearch(storage, 0);
  await importEmails(storage, search, emails.map(normalizeEmail));
  const registry = createInboxRegistry({ search });
  const ctx: ToolContext = {
    storage,
    signal: new AbortController().signal,
    now: () => new Date("2026-11-16T12:00:00Z"),
  };
  return { storage, search, registry, ctx };
}

async function play(s: Awaited<ReturnType<typeof seed>>, prompt: string) {
  const agent = createAgent({
    provider: new MockProvider({ scripts: inboxScripts }),
    registry: s.registry,
    storage: s.storage,
  });
  const events: AgentEvent[] = [];
  for await (const e of agent.run(prompt, { approve: () => true })) events.push(e);
  return (
    events
      .filter((e) => e.type === "message")
      .map((e) => (e.type === "message" ? e.text : ""))
      .at(-1) ?? ""
  );
}

describe("review regressions: mbox", () => {
  it("does not split a message at an unescaped 'From ' line that is not a real separator", () => {
    const text = [
      "From a@x Thu Jan  1 00:00:00 2024",
      "Subject: one",
      "",
      "Hi,",
      "",
      "From here on, I will reply from my new address.",
      "",
      "From b@x Fri Jan  2 10:30:00 2024",
      "Subject: two",
      "",
      "Ok",
      "",
    ].join("\n");
    const out = splitMbox(text);
    expect(out).toHaveLength(2);
    expect(out[0]).toContain("From here on, I will reply");
  });

  it("splits on Google Takeout separators", () => {
    const text =
      "From 1789012345678901234@xxx Mon Jan 01 00:00:00 +0000 2024\nSubject: a\n\nx\n\nFrom 1789012345678901235@xxx Tue Jan 02 00:00:00 +0000 2024\nSubject: b\n\ny\n";
    expect(splitMbox(text)).toHaveLength(2);
  });
});

describe("review regressions: reply-to and labels", () => {
  it("drafts a reply to Reply-To when the sender set one", async () => {
    const e = await (async () => {
      const raw =
        "Message-ID: <rt@x>\nFrom: List <noreply@list.example>\nReply-To: Sam <sam@example.com>\nSubject: Question\nDate: Mon, 01 Jan 2024 10:00:00 +0000\n\nCan you help?\n";
      for await (const ev of readEmails(fileFrom("q.eml", raw)))
        if (ev.kind === "email") return ev.email;
      throw new Error("no email");
    })();
    expect(e.replyTo).toEqual([{ name: "Sam", address: "sam@example.com" }]);
    const s = await seed([e]);
    const r = await s.registry.run("draft_reply", { id: "mid:rt@x", body: "Sure." }, s.ctx);
    expect(r.ok && (r.value as { to: string }).to).toBe("sam@example.com");
  });

  it("keeps labels in any script and matches label filters however they are typed", async () => {
    expect(normalizeLabel("旅行")).toBe("旅行");
    const s = await seed([
      {
        messageId: "l@x",
        from: { name: "", address: "a@x" },
        subject: "Trip",
        date: "Mon, 01 Jan 2024 10:00:00 +0000",
        text: "x",
      },
    ]);
    await s.registry.run("label_email", { id: "mid:l@x", add: ["Follow Up"] }, s.ctx);
    const r = await s.registry.run("search_emails", { label: "Follow Up" }, s.ctx);
    expect(r.ok && (r.value as { total: number }).total).toBe(1);
  });

  it("filters by category across every match, not just the top-ranked thousand", async () => {
    const many = Array.from({ length: 1100 }, (_, i) => ({
      messageId: `m${i}@x`,
      from: { name: "", address: "a@x" },
      subject: "lantern lantern",
      date: "Mon, 01 Jan 2024 10:00:00 +0000",
      text: "lantern lantern lantern",
    }));
    const rare = {
      messageId: "rare@x",
      from: { name: "", address: "b@x" },
      subject: "Notes",
      date: "Mon, 01 Jan 2024 10:00:00 +0000",
      text: "one lantern among many other words in a long body of text here",
    };
    const s = await seed([...many, rare]);
    await s.registry.run(
      "classify_emails",
      { assignments: [{ id: "mid:rare@x", category: "personal" }] },
      s.ctx,
    );
    const r = await s.registry.run(
      "search_emails",
      { query: "lantern", category: "personal" },
      s.ctx,
    );
    expect(r.ok && (r.value as { total: number }).total).toBe(1);
  });
});

describe("review regressions: demo honesty outside the sample", () => {
  const mail = (id: string, from: string, subject: string) => ({
    messageId: id,
    from: { name: from, address: `${from.toLowerCase()}@example.net` },
    subject,
    date: "Mon, 01 Jan 2024 10:00:00 +0000",
    text: "Hello there, can we talk about dinner tomorrow?",
  });

  it("does not draft the scripted dinner reply to someone who is not in the sample", async () => {
    const s = await seed([mail("real-maya@x", "Maya", "Dinner tomorrow?")]);
    const final = await play(s, DEMO_PROMPTS.draft);
    expect(await s.storage.list<Draft>(DRAFTS)).toEqual([]);
    expect(final).toMatch(/Demo mode/);
  });

  it("says that waiting-for-reply guesses outside the sample are guesses", async () => {
    const s = await seed([mail("q1@x", "Lee", "Are you coming?")]);
    expect(await play(s, DEMO_PROMPTS.replies)).toMatch(/guess/i);
  });

  it("says that sorting outside the sample uses rough guesses", async () => {
    const s = await seed([mail("q2@x", "Lee", "Are you coming?")]);
    expect(await play(s, DEMO_PROMPTS.sort)).toMatch(/guess/i);
    expect((await s.storage.list<Email>(EMAILS))[0]?.category).toBeDefined();
  });
});

describe("review regressions: zip", () => {
  it("reads a multi-megabyte mbox inside a zip in slices and finds every message", async () => {
    const { zipSync } = await import("fflate");
    const { writeMbox, MAX_ZIP_BYTES } = await import("../src/importers");
    const msgs = Array.from(
      { length: 3000 },
      (_, i) =>
        `Message-ID: <z${i}@x>\nFrom: a@x\nSubject: s${i}\nDate: Mon, 01 Jan 2024 10:00:00 +0000\n\n${"word ".repeat(200)}\n`,
    );
    const mbox = new TextEncoder().encode(writeMbox(msgs));
    expect(mbox.length).toBeGreaterThan(3_000_000);
    let n = 0;
    for await (const ev of readEmails(fileFrom("takeout.zip", zipSync({ "Mail/All.mbox": mbox }))))
      if (ev.kind === "email") n++;
    expect(n).toBe(3000);
    expect(MAX_ZIP_BYTES).toBe(500 * 1_048_576);
  });

  it("explains that a very large zip should be unzipped first", async () => {
    const huge = {
      name: "takeout.zip",
      size: 600 * 1_048_576,
      stream: () => new ReadableStream(),
      arrayBuffer: async () => new ArrayBuffer(0),
    };
    const run = async () => {
      for await (const _ of readEmails(huge)) void _;
    };
    await expect(run()).rejects.toThrow(/over 500 MB\. Unzip it/);
  });
});

describe("review regressions: demo honesty in drafts", () => {
  it("marks drafts written by the scripted demo", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const bytes = new Uint8Array(
      readFileSync(resolve(import.meta.dirname, "../public/sample/inbox.mbox")),
    );
    const storage = new MemoryStorage();
    const search = createInboxSearch(storage, 0);
    async function* all() {
      for await (const ev of readEmails(fileFrom("inbox.mbox", bytes)))
        if (ev.kind === "email") yield ev.email;
    }
    await importEmails(storage, search, all());
    const agent = createAgent({
      provider: new MockProvider({ scripts: inboxScripts }),
      registry: createInboxRegistry({ search }),
      storage,
    });
    for await (const _ of agent.run(DEMO_PROMPTS.draft, { approve: () => true })) void _;
    const [d] = await storage.list<Draft>(DRAFTS);
    expect(d?.by).toBe("demo");
  });
});
