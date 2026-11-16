import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import fc from "fast-check";
import { zipSync } from "fflate";
import { MemoryStorage } from "@seance/storage";
import { describe, expect, it } from "vitest";
import { emailId, normalizeEmail, type RawEmail } from "../src/domain/normalize";
import { createInboxSearch, importEmails } from "../src/domain/store";
import { EMAILS, type NormalizedEmail } from "../src/domain/types";
import {
  MboxSplitter,
  ImportError,
  fileFrom,
  htmlToText,
  readEmails,
  splitMbox,
  writeMbox,
  type ReadEvent,
} from "../src/importers";

const fixtureBytes = (name: string) =>
  new Uint8Array(readFileSync(resolve(import.meta.dirname, "fixtures", name)));

async function collect(gen: AsyncGenerator<ReadEvent>) {
  const emails: NormalizedEmail[] = [];
  const skipped: { where: string; reason: string }[] = [];
  for await (const e of gen) {
    if (e.kind === "email") emails.push(e.email);
    if (e.kind === "skipped") skipped.push(e.item);
  }
  return { emails, skipped };
}

describe("mbox fixture", () => {
  it("splits messages, unescapes >From lines, decodes charsets, converts HTML, and skips junk", async () => {
    const { emails, skipped } = await collect(
      readEmails(fileFrom("small.mbox", fixtureBytes("small.mbox"))),
    );
    expect(emails.map((e) => e.subject)).toEqual([
      "Dinner on Saturday?",
      "Five herbs that survive winter 🌿",
      "Your order has shipped",
      "Dinner on Saturday?",
    ]);
    const [dinner, sprout, parcel] = emails;
    expect(dinner).toMatchObject({
      messageId: "dinner-1@example.com",
      from: { name: "Maya Chen", address: "maya@example.com" },
      date: "2025-05-03T07:15:00.000Z",
      text: "Are you free at 8?\n\nFrom the top: bring dessert.\n>From an older quote",
    });
    expect(sprout?.text).toBe(
      "Thyme & rosemary love a café window.\n\n• Sage\n• Mint\n\nUnsubscribe (https://sprout.example/unsub)",
    );
    expect(parcel).toMatchObject({ messageId: null, date: "2025-05-06T18:30:00.000Z" });
    expect(skipped).toEqual([{ where: "#4", reason: "not an email (no headers)" }]);
  });

  it("reads a single .eml and an export zip", async () => {
    const eml = await collect(readEmails(fileFrom("boiler.eml", fixtureBytes("boiler.eml"))));
    expect(eml.emails[0]).toMatchObject({
      subject: "Boiler service next Tuesday",
      cc: [{ name: "Lee", address: "lee@example.net" }],
    });

    const zip = zipSync({
      "Takeout/Mail/All mail Including Spam and Trash.mbox": fixtureBytes("small.mbox"),
      "Takeout/Mail/boiler.eml": fixtureBytes("boiler.eml"),
      "Takeout/archive_browser.html": new TextEncoder().encode("<html></html>"),
    });
    const z = await collect(readEmails(fileFrom("takeout.zip", zip)));
    expect(z.emails).toHaveLength(5);
  });

  it("rejects unsupported files with a plain reason", async () => {
    await expect(collect(readEmails(fileFrom("notes.pdf", "x")))).rejects.toThrow(ImportError);
    await expect(
      collect(readEmails(fileFrom("empty.zip", zipSync({ "a.txt": new Uint8Array([1]) })))),
    ).rejects.toThrow(/no \.mbox or \.eml/);
  });
});

describe("mbox splitter on sloppy files", () => {
  it("keeps an unescaped From line inside a body when it does not follow a blank line", () => {
    const text =
      "From a@x Thu Jan  1 00:00:00 2024\nSubject: one\n\nI agree.\nFrom here on, though, I disagree.\n\nFrom b@x Fri Jan  2 10:30:00 2024\nSubject: two\n\nOk\n";
    const out = splitMbox(text);
    expect(out).toHaveLength(2);
    expect(out[0]).toContain("From here on, though, I disagree.");
  });

  it("keeps a final message that has no trailing newline", () => {
    expect(splitMbox("From a@x\nSubject: one\n\nlast line")).toEqual(["Subject: one\n\nlast line"]);
  });
});

describe("htmlToText", () => {
  it("stays linear on hostile HTML (unclosed tags, comments, angle brackets)", () => {
    const hostile = [
      "<style>".repeat(70_000),
      "<a href='https://x.example'>".repeat(20_000),
      "<!--".repeat(120_000),
      "<".repeat(500_000),
      "<li".repeat(150_000),
    ];
    for (const html of hostile) {
      const t = performance.now();
      htmlToText(html);
      expect(performance.now() - t).toBeLessThan(300);
    }
  });

  it("drops the rest of an unclosed style or script block instead of showing code", () => {
    expect(htmlToText("<p>Hello</p><style>p{color:red}")).toBe("Hello");
    expect(htmlToText("<p>Hi</p><script>alert(1)")).toBe("Hi");
  });

  it("keeps structure and link targets, drops styles, scripts and entities", () => {
    expect(
      htmlToText(
        "<style>x{}</style><h1>Hi</h1><p>A&nbsp;&amp;&#233;&#x1F47B;</p><script>bad()</script>Line<br>Two",
      ),
    ).toBe("Hi\n\nA &é👻\nLine\nTwo");
  });
});

// ---------- Properties ----------

/** Body lines that stress an mbox splitter. */
const bodyLine = fc.oneof(
  fc.string({ maxLength: 20 }).map((s) => s.replace(/\n/g, " ")),
  fc.constantFrom(
    "From ",
    "From me",
    ">From quoted",
    ">>From double",
    "",
    "\r",
    "From\r",
    " From x",
    "Fromage",
  ),
);
const rawMessage = fc
  .tuple(
    fc.string({ minLength: 1, maxLength: 12 }).map((s) => s.replace(/[\n\r]/g, "x")),
    fc.array(bodyLine, { maxLength: 8 }),
  )
  .map(([subject, body]) => [`Subject: ${subject}`, "", ...body].join("\n") + "\n");

/** Cut a string at random points. */
const chunked = (text: string, cuts: number[]) => {
  const points = [...new Set(cuts.map((c) => c % (text.length + 1)))].sort((a, b) => a - b);
  const parts: string[] = [];
  let prev = 0;
  for (const p of points) {
    parts.push(text.slice(prev, p));
    prev = p;
  }
  parts.push(text.slice(prev));
  return parts;
};

describe("mbox properties", () => {
  it("P4 split(write(messages)) returns exactly the messages, including bodies with From lines", () => {
    fc.assert(
      fc.property(fc.array(rawMessage, { maxLength: 8 }), (messages) => {
        expect(splitMbox(writeMbox(messages))).toEqual(messages);
      }),
      { numRuns: 400 },
    );
  });

  it("P4 the result does not depend on how the stream is chunked", () => {
    fc.assert(
      fc.property(
        fc.array(rawMessage, { maxLength: 6 }),
        fc.array(fc.nat(), { maxLength: 12 }),
        (messages, cuts) => {
          const text = writeMbox(messages);
          const s = new MboxSplitter();
          const out = [...chunked(text, cuts).flatMap((c) => s.push(c)), ...s.end()];
          expect(out).toEqual(messages);
        },
      ),
      { numRuns: 400 },
    );
  });
});

const address = fc.record({
  name: fc.oneof(fc.constant(""), fc.string({ maxLength: 12 })),
  address: fc.oneof(fc.constant(""), fc.emailAddress(), fc.constant("  Mixed@Case.Example ")),
});
const rawEmail: fc.Arbitrary<RawEmail> = fc.record({
  messageId: fc.option(
    fc.oneof(fc.string({ maxLength: 10 }), fc.constant("<a@b>"), fc.constant("  <x@y> ")),
    { nil: undefined },
  ),
  from: address,
  to: fc.array(address, { maxLength: 3 }),
  cc: fc.array(address, { maxLength: 2 }),
  subject: fc.oneof(fc.string({ maxLength: 20 }), fc.constant("  ")),
  date: fc.oneof(
    fc.date({ noInvalidDate: true }).map((d) => d.toUTCString()),
    fc.constant("not a date"),
  ),
  text: fc
    .array(fc.oneof(fc.string({ maxLength: 15 }), fc.constantFrom("", "   ", "\r", "a \t")), {
      maxLength: 8,
    })
    .map((l) => l.join("\r\n")),
  attachments: fc.oneof(fc.nat(3), fc.constant(-1)),
});

describe("email properties", () => {
  it("P2 normalizeEmail is idempotent", () => {
    fc.assert(
      fc.property(rawEmail, (raw) => {
        const once = normalizeEmail(raw);
        expect(normalizeEmail(once)).toEqual(once);
        expect(emailId(normalizeEmail(once))).toBe(emailId(once));
      }),
      { numRuns: 400 },
    );
  });

  it("P3 importing the same mail N times stores the same set as importing once", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(rawEmail.map(normalizeEmail), { maxLength: 8 }),
        fc.integer({ min: 2, max: 3 }),
        async (emails, times) => {
          const once = new MemoryStorage();
          await importEmails(once, createInboxSearch(once, 0), emails);
          const many = new MemoryStorage();
          const search = createInboxSearch(many, 0);
          let last;
          for (let i = 0; i < times; i++) last = await importEmails(many, search, emails);
          expect(await many.list(EMAILS)).toEqual(await once.list(EMAILS));
          expect(last?.added).toBe(0);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("P3 a duplicate inside one mbox is stored once", async () => {
    const storage = new MemoryStorage();
    const search = createInboxSearch(storage, 0);
    const { emails } = await collect(
      readEmails(fileFrom("small.mbox", fixtureBytes("small.mbox"))),
    );
    expect(await importEmails(storage, search, emails)).toEqual({ added: 3, duplicates: 1 });
  });
});
