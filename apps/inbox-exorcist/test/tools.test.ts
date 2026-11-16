import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createAgent, type AgentEvent, type ToolContext } from "@seance/core";
import { MockProvider } from "@seance/llm";
import { MemoryStorage } from "@seance/storage";
import { describe, expect, it } from "vitest";
import { setLocale } from "@seance/ui";
import { DEMO_PROMPTS, inboxScripts } from "../src/demo/scripts";
import { inboxDemoMessages } from "../src/messages";
import { createInboxSearch, importEmails } from "../src/domain/store";
import { DRAFTS, EMAILS, type Draft, type Email } from "../src/domain/types";
import { fileFrom, readEmails } from "../src/importers";
import { createInboxRegistry } from "../src/tools";
import { normalizeLabel } from "../src/tools/shared";

const sampleBytes = new Uint8Array(
  readFileSync(resolve(import.meta.dirname, "../public/sample/inbox.mbox")),
);

async function seeded() {
  const storage = new MemoryStorage();
  const search = createInboxSearch(storage, 0);
  await search.load();
  async function* emails() {
    for await (const e of readEmails(fileFrom("inbox.mbox", sampleBytes)))
      if (e.kind === "email") yield e.email;
  }
  const counts = await importEmails(storage, search, emails());
  const registry = createInboxRegistry({ search });
  const ctx: ToolContext = {
    storage,
    signal: new AbortController().signal,
    now: () => new Date("2026-11-16T12:00:00Z"),
  };
  const bySubject = async (s: string) =>
    (await storage.list<Email>(EMAILS)).find((e) => e.subject === s)!;
  return { storage, search, registry, ctx, counts, bySubject };
}

type Out<T> = { ok: true; value: T } | { ok: false; error: { type: string } };
const value = <T>(r: unknown) => (r as Out<T> & { ok: true }).value;

describe("sample inbox", () => {
  it("imports all 18 messages, decodes the HTML newsletter and keeps the From line in Jonas's mail", async () => {
    const { counts, bySubject } = await seeded();
    expect(counts).toEqual({ added: 18, duplicates: 0 });
    expect((await bySubject("Five herbs that survive winter 🌿")).text).toContain(
      "Thyme, rosemary, sage",
    );
    expect((await bySubject("Fwd: the band schedule")).text).toContain("\nFrom the top, we play");
    expect((await bySubject("Reservation confirmed: 14–18 June")).from.address).toBe(
      "reservations@mirador.example",
    );
  });
});

describe("inbox tools", () => {
  it("search finds words, senders and filters by category, label and date", async () => {
    const { registry, ctx } = await seeded();
    const maya = value<{ results: { subject: string }[] }>(
      await registry.run("search_emails", { query: "Maya dinner" }, ctx),
    );
    expect(maya.results.map((r) => r.subject)).toEqual(["Dinner on Saturday?"]);
    const fromNorthwind = value<{ total: number }>(
      await registry.run("search_emails", { from: "northwind", limit: 50 }, ctx),
    );
    expect(fromNorthwind.total).toBe(2);
    const june = value<{ total: number }>(
      await registry.run("search_emails", { after: "2025-06-05", limit: 50 }, ctx),
    );
    expect(june.total).toBe(2);
    const uncategorized = value<{ total: number }>(
      await registry.run("search_emails", { category: "uncategorized", limit: 50 }, ctx),
    );
    expect(uncategorized.total).toBe(18);
  });

  it("classify saves categories in one batch and skips unknown ids", async () => {
    const { registry, ctx, storage, bySubject } = await seeded();
    const boiler = await bySubject("Boiler service next Tuesday");
    const r = value<{ updated: unknown[]; skipped: string[] }>(
      await registry.run(
        "classify_emails",
        {
          assignments: [
            { id: boiler.id, category: "needs-reply" },
            { id: "nope", category: "noise" },
          ],
        },
        ctx,
      ),
    );
    expect(r.skipped).toEqual(["nope"]);
    expect((await storage.get<Email>(EMAILS, boiler.id))?.category).toBe("needs-reply");
    const filtered = value<{ total: number }>(
      await registry.run("search_emails", { category: "needs-reply" }, ctx),
    );
    expect(filtered.total).toBe(1);
    expect(
      await registry.run(
        "classify_emails",
        { assignments: [{ id: boiler.id, category: "urgent" }] },
        ctx,
      ),
    ).toMatchObject({
      ok: false,
      error: { type: "InvalidInput" },
    });
  });

  it("draft_reply saves a draft addressed to the sender and never sends", async () => {
    const { registry, ctx, storage, bySubject } = await seeded();
    const slides = await bySubject("Can you review my slides by Thursday?");
    const r = value<{ to: string; subject: string; sent: boolean }>(
      await registry.run(
        "draft_reply",
        { id: slides.id, body: "Sure, sending notes Wednesday." },
        ctx,
      ),
    );
    expect(r).toMatchObject({
      to: "priya@example.com",
      subject: "Re: Can you review my slides by Thursday?",
      sent: false,
    });
    expect(await storage.list<Draft>(DRAFTS)).toHaveLength(1);
    const read = value<{ drafts: number }>(
      await registry.run("read_email", { id: slides.id }, ctx),
    );
    expect(read.drafts).toBe(1);
  });

  it("labels are normalized and removable", async () => {
    const { registry, ctx, bySubject } = await seeded();
    const mum = await bySubject("Photos from the garden");
    expect(
      value<{ labels: string[] }>(
        await registry.run("label_email", { id: mum.id, add: ["Family Stuff", "garden"] }, ctx),
      ).labels,
    ).toEqual(["family-stuff", "garden"]);
    expect(
      value<{ labels: string[] }>(
        await registry.run("label_email", { id: mum.id, remove: ["GARDEN"] }, ctx),
      ).labels,
    ).toEqual(["family-stuff"]);
    expect(normalizeLabel(" Follow Up! ")).toBe("follow-up");
  });

  it("banish hides in bulk, lists what it hid, and keeps the mail", async () => {
    const { registry, ctx, storage, bySubject } = await seeded();
    const a = await bySubject("48 hours only: 60% off everything");
    const b = await bySubject("Congratulations!!! Claim your prize now");
    const r = value<{ banished: { subject: string }[]; undoToken: string }>(
      await registry.run("banish_emails", { ids: [a.id, b.id] }, ctx),
    );
    expect(r.banished.map((x) => x.subject).sort()).toEqual([a.subject, b.subject].sort());
    expect(
      value<{ total: number }>(await registry.run("search_emails", { limit: 50 }, ctx)).total,
    ).toBe(16);
    expect(await storage.list(EMAILS)).toHaveLength(18);
  });

  it("no tool can send mail", async () => {
    const { registry } = await seeded();
    const names = registry.list().map((t) => t.name);
    expect(names).toHaveLength(7);
    expect(names.some((n) => /send|forward|smtp/i.test(n))).toBe(false);
  });
});

describe("demo scripts run end to end on the sample inbox", () => {
  async function play(prompt: string, approve = true) {
    const s = await seeded();
    const agent = createAgent({
      provider: new MockProvider({ scripts: inboxScripts }),
      registry: s.registry,
      storage: s.storage,
      now: s.ctx.now,
    });
    const events: AgentEvent[] = [];
    for await (const e of agent.run(prompt, { approve: () => approve })) events.push(e);
    const failed = events.filter(
      (e) => e.type === "tool_result" && !e.ok && e.error?.type !== "Rejected",
    );
    const texts = events
      .filter((e) => e.type === "message")
      .map((e) => (e.type === "message" ? e.text : ""));
    return { ...s, events, failed, final: texts.at(-1) ?? "" };
  }

  it("sort: classifies all 18 in one approved batch", async () => {
    const r = await play(DEMO_PROMPTS.sort);
    expect(r.failed).toEqual([]);
    expect(r.events.filter((e) => e.type === "approval_requested")).toHaveLength(1);
    const all = await r.storage.list<Email>(EMAILS);
    expect(all.every((e) => e.category)).toBe(true);
    expect(
      all
        .filter((e) => e.category === "needs-reply")
        .map((e) => e.subject)
        .sort(),
    ).toEqual([
      "Boiler service next Tuesday",
      "Can you review my slides by Thursday?",
      "Dinner on Saturday?",
    ]);
    expect(r.final).toContain("3 needs reply");
  });

  it("replies: lists the three people waiting, without changing anything", async () => {
    const r = await play(DEMO_PROMPTS.replies);
    expect(r.failed).toEqual([]);
    expect(r.events.some((e) => e.type === "approval_requested")).toBe(false);
    expect(r.final).toContain("3 people are waiting on you");
    expect(r.final).toContain("Sam Okafor");
  });

  it("draft: saves a reply to Maya and says nothing was sent", async () => {
    const r = await play(DEMO_PROMPTS.draft);
    expect(r.failed).toEqual([]);
    const [d] = await r.storage.list<Draft>(DRAFTS);
    expect(d).toMatchObject({ to: "maya@example.com", subject: "Re: Dinner on Saturday?" });
    expect(r.final).toContain("Nothing was sent");
  });

  it("banish: hides exactly the five newsletters, and rejecting keeps them", async () => {
    const r = await play(DEMO_PROMPTS.banish);
    expect(r.failed).toEqual([]);
    const hidden = (await r.storage.list<Email>(EMAILS))
      .filter((e) => e.banishedAt)
      .map((e) => e.from.address)
      .sort();
    expect(hidden).toEqual([
      "deals@flashdeals.example",
      "hello@beanclub.example",
      "info@ironworks.example",
      "newsletter@sprout.example",
      "newsletter@sprout.example",
    ]);
    const no = await play(DEMO_PROMPTS.banish, false);
    expect((await no.storage.list<Email>(EMAILS)).some((e) => e.banishedAt)).toBe(false);
    expect(no.final).toBe("Okay, I kept them all.");
  });

  it("travel: labels the flight and hotel mail", async () => {
    const r = await play(DEMO_PROMPTS.travel);
    expect(r.failed).toEqual([]);
    const travel = (await r.storage.list<Email>(EMAILS))
      .filter((e) => e.labels.includes("travel"))
      .map((e) => e.subject)
      .sort();
    expect(travel).toEqual([
      "Check-in is open for LX4821",
      "Reservation confirmed: 14–18 June",
      "Your booking LX4821 is confirmed",
    ]);
  });

  it("answers the Chinese prompt with the same tools, in Chinese", async () => {
    setLocale("zh");
    try {
      const r = await play(inboxDemoMessages.zh.prompts.sort);
      expect(r.final).toMatch(/^完成：/);
      expect(r.final).toContain("待回复");
    } finally {
      setLocale("en");
    }
  });
});
