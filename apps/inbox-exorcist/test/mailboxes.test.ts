import fc from "fast-check";
import { MemoryStorage } from "@seance/storage";
import { describe, expect, it } from "vitest";
import { guessMailbox, headerAddress, normalizeEmail } from "../src/domain/normalize";
import { createInboxSearch, importEmails } from "../src/domain/store";
import { EMAILS, type Email, type NormalizedEmail } from "../src/domain/types";
import { fileFrom, readEmails } from "../src/importers";
import { createInboxRegistry } from "../src/tools";

const addr = fc.constantFrom("a@x.test", "b@x.test", "c@y.test", "d@y.test");
const person = addr.map((address) => ({ name: "", address }));
const mail = fc.record({
  deliveredTo: fc.option(addr, { nil: null }),
  from: person,
  to: fc.array(person, { maxLength: 3 }),
  cc: fc.array(person, { maxLength: 2 }),
});

describe("mailboxes", () => {
  it("P2 guessMailbox picks the most delivered-to address, else the most frequent one", () => {
    fc.assert(
      fc.property(fc.array(mail, { maxLength: 30 }), (emails) => {
        const got = guessMailbox(emails);
        const delivered = emails.flatMap((e) => (e.deliveredTo ? [e.deliveredTo] : []));
        const pool = delivered.length
          ? delivered
          : emails.flatMap((e) => [e.from, ...e.to, ...e.cc].map((a) => a.address));
        if (pool.length === 0) {
          expect(got).toBeNull();
          return;
        }
        const count = (a: string) => pool.filter((x) => x === a).length;
        expect(pool).toContain(got);
        expect(count(got as string)).toBe(Math.max(...pool.map(count)));
      }),
    );
  });

  it("P2 normalizeEmail stays idempotent with Delivered-To", () => {
    fc.assert(
      fc.property(fc.string(), (raw) => {
        const once = normalizeEmail({ deliveredTo: raw, from: { address: "a@x.test" } });
        expect(normalizeEmail(once)).toEqual(once);
      }),
    );
  });

  it("reads the bare address out of a Delivered-To header", () => {
    expect(headerAddress("Alex Rivera <Alex@Example.com>")).toBe("alex@example.com");
    expect(headerAddress(" alex@example.com ")).toBe("alex@example.com");
    expect(headerAddress("not an address")).toBeNull();
    expect(headerAddress(undefined)).toBeNull();
  });

  const msg = (id: string, from: string, to: string, delivered?: string) =>
    [
      `From ${from} Mon Jun  2 10:00:00 2025`,
      ...(delivered ? [`Delivered-To: ${delivered}`] : []),
      `Message-ID: <${id}>`,
      `From: ${from}`,
      `To: ${to}`,
      `Subject: ${id}`,
      `Date: Mon, 2 Jun 2025 10:00:00 +0000`,
      "",
      "Hello.",
      "", // mbox needs a blank line before the next "From " separator
      "",
    ].join("\n");

  async function load(storage: MemoryStorage, name: string, text: string) {
    const search = createInboxSearch(storage, 0);
    async function* emails(): AsyncGenerator<NormalizedEmail> {
      for await (const ev of readEmails(fileFrom(name, text)))
        if (ev.kind === "email") yield ev.email;
    }
    await importEmails(storage, search, emails());
    return search;
  }

  it("each file's mail lands in its own mailbox, sent mail included, and search filters by it", async () => {
    const storage = new MemoryStorage();
    await load(
      storage,
      "work.mbox",
      msg("w1", "boss@corp.test", "me@work.test", "me@work.test") +
        msg("w2", "hr@corp.test", "me@work.test", "me@work.test") +
        msg("w3", "me@work.test", "boss@corp.test"), // sent mail has no Delivered-To
    );
    const search = await load(
      storage,
      "home.mbox",
      msg("h1", "mum@home.test", "me@home.test") +
        msg("h2", "me@home.test", "mum@home.test") +
        msg("h3", "shop@store.test", "me@home.test"),
    );
    const mailboxes = Object.fromEntries(
      (await storage.list<Email>(EMAILS)).map((e) => [e.id, e.mailbox]),
    );
    expect(mailboxes).toEqual({
      "mid:w1": "me@work.test",
      "mid:w2": "me@work.test",
      "mid:w3": "me@work.test",
      "mid:h1": "me@home.test",
      "mid:h2": "me@home.test",
      "mid:h3": "me@home.test",
    });
    const run = await createInboxRegistry({ search }).run(
      "search_emails",
      { mailbox: "ME@home.test" },
      { storage, signal: new AbortController().signal, now: () => new Date() },
    );
    expect(run.ok && (run.value as { total: number }).total).toBe(3);
  });

  it("re-importing gives a mailbox to mail imported before mailboxes existed, keeping its labels", async () => {
    const storage = new MemoryStorage();
    const text = msg("o1", "a@x.test", "me@old.test") + msg("o2", "b@x.test", "me@old.test");
    await load(storage, "old.mbox", text);
    for (const e of await storage.list<Email>(EMAILS)) {
      const { mailbox: _m, ...old } = e;
      await storage.put(EMAILS, { ...old, labels: ["kept"] });
    }
    await load(storage, "old.mbox", text);
    for (const e of await storage.list<Email>(EMAILS)) {
      expect(e.mailbox).toBe("me@old.test");
      expect(e.labels).toEqual(["kept"]);
    }
  });
});
