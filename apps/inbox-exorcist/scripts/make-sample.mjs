#!/usr/bin/env node
// Generates the fictional sample inbox in public/sample/ as a real mbox (mboxrd) file.
// Every person, company and address is made up. Domains use the reserved .example TLD or
// example.com/net/org. Run: node scripts/make-sample.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const out = resolve(import.meta.dirname, "../public/sample");
const ME = "Alex Rivera <alex@example.com>";

/** [message-id, from, subject, RFC 2822 date, body, options] */
const mail = [
  [
    "dinner-saturday@example.com",
    "Maya Chen <maya@example.com>",
    "Dinner on Saturday?",
    "Mon, 02 Jun 2025 18:42:00 +0200",
    "Hi Alex,\n\nAre you free for dinner on Saturday? I was thinking of the new Lebanese place on Ash Street, around 8.\nLet me know and I'll book a table.\n\nMaya",
  ],
  [
    "sprout-112@sprout.example",
    "The Weekly Sprout <newsletter@sprout.example>",
    "Five herbs that survive winter 🌿",
    "Mon, 02 Jun 2025 06:00:00 +0000",
    '<html><head><style>p{font-family:Georgia}</style></head><body><h1>Five herbs that survive winter</h1><p>Thyme, rosemary, sage, chives and mint will all come back in spring if you give them a sheltered spot.</p><p><a href="https://sprout.example/unsub?u=1">Unsubscribe</a> &middot; <a href="https://sprout.example/web">View in browser</a></p><img src="https://t.sprout.example/open.gif" width="1" height="1"></body></html>',
    { html: true },
  ],
  [
    "booking-lx4821@northwind.example",
    "Northwind Air <bookings@northwind.example>",
    "Your booking LX4821 is confirmed",
    "Fri, 30 May 2025 11:05:00 +0000",
    "Booking reference: LX4821\nPassenger: Alex Rivera\nLisbon (LIS) → Amsterdam (AMS), 14 June 2025, 09:40\nTotal paid: €142.30\n\nThank you for flying Northwind.",
  ],
  [
    "res-55190@mirador.example",
    "Hotel Mirador <reservations@mirador.example>",
    "Reservation confirmed: 14–18 June",
    "Sat, 31 May 2025 09:12:00 +0200",
    "Dear Alex,\n\nYour room is booked from 14 to 18 June 2025 (4 nights). Check-in from 15:00.\nReservation number: 55190.\n\nWe look forward to welcoming you.\nHotel Mirador",
    { utf8: true },
  ],
  [
    "boiler-service@example.net",
    "Sam Okafor <sam.okafor@example.net>",
    "Boiler service next Tuesday",
    "Wed, 04 Jun 2025 08:30:00 +0100",
    "Hi Alex,\n\nThe engineer is booked for Tuesday 10 June between 10:00 and 12:00 to service the boiler.\nCan you confirm someone will be home to let them in?\n\nThanks,\nSam (landlord)",
  ],
  [
    "ship-77410@pixelparcel.example",
    "Pixel Parcel <no-reply@pixelparcel.example>",
    "Your order has shipped",
    "Tue, 03 Jun 2025 14:20:00 -0400",
    "Good news: order #77410 (1 × USB-C cable, 2 m) is on its way.\nTracking number: PP-4471-0092.\nEstimated delivery: Friday.",
  ],
  [
    "storage-w22@cloudnote.example",
    "CloudNote <noreply@cloudnote.example>",
    "Your weekly storage report",
    "Sun, 01 Jun 2025 07:00:00 +0000",
    "You are using 3.2 GB of 5 GB. Your largest notebook is Recipes (1.1 GB).",
  ],
  [
    "deals-0601@flashdeals.example",
    "Flash Deals <deals@flashdeals.example>",
    "48 hours only: 60% off everything",
    "Sun, 01 Jun 2025 05:30:00 +0000",
    "Everything must go! 60% off for 48 hours.\nShop now: https://flashdeals.example/sale\n\nUnsubscribe: https://flashdeals.example/unsub",
  ],
  [
    "garden-photos@example.org",
    "Mum <mum@example.org>",
    "Photos from the garden",
    "Sat, 31 May 2025 16:45:00 +0100",
    "The roses finally opened! I've attached three photos. Your dad says the tomatoes are doing better than last year.\n\nLove, Mum",
    { attachments: 3 },
  ],
  [
    "slides-review@example.com",
    "Priya Raman <priya@example.com>",
    "Can you review my slides by Thursday?",
    "Tue, 03 Jun 2025 10:02:00 +0200",
    "Hi Alex,\n\nI'm presenting the Q2 roadmap on Friday. Could you look over my slides by Thursday and flag anything unclear? 12 slides, should take 15 minutes.\n\nThanks!\nPriya",
  ],
  [
    "due-soon-3381@library.example",
    "City Library <notices@library.example>",
    "Your book is due in 3 days",
    "Wed, 04 Jun 2025 07:15:00 +0100",
    '"The Left Hand of Darkness" is due on 7 June. You can renew it online twice.',
  ],
  [
    "sprout-113@sprout.example",
    "The Weekly Sprout <newsletter@sprout.example>",
    "Composting for small balconies",
    "Mon, 26 May 2025 06:00:00 +0000",
    '<html><body><h1>Composting for small balconies</h1><p>A sealed bokashi bin fits under a sink and never smells.</p><p><a href="https://sprout.example/unsub?u=1">Unsubscribe</a></p></body></html>',
    { html: true },
  ],
  [
    "statement-may@ledgerbank.example",
    "Ledger Bank <alerts@ledgerbank.example>",
    "Your May statement is ready",
    "Mon, 02 Jun 2025 05:00:00 +0000",
    "Your statement for May 2025 is ready to view in online banking. We will never ask for your password by email.",
  ],
  [
    "missyou-20@beanclub.example",
    "Bean Club <hello@beanclub.example>",
    "We miss you! Here's 20% off",
    "Thu, 29 May 2025 12:00:00 +0000",
    "It's been a while! Use code COMEBACK20 for 20% off your next bag of beans.\n\nUnsubscribe at https://beanclub.example/unsub",
  ],
  [
    "band-schedule@example.net",
    "Jonas Berg <jonas@example.net>",
    "Fwd: the band schedule",
    "Thu, 05 Jun 2025 21:10:00 +0200",
    "Here's the plan for Saturday's rehearsal:\n\n19:00 sound check\n19:30 full run\n\nFrom the top, we play the new song twice, then the old set.\nBring your capo!\n\nJonas",
  ],
  [
    "checkin-lx4821@northwind.example",
    "Northwind Air <bookings@northwind.example>",
    "Check-in is open for LX4821",
    "Fri, 13 Jun 2025 09:40:00 +0000",
    "Online check-in is now open for your flight LX4821 to Amsterdam tomorrow at 09:40.",
  ],
  [
    "timetable-june@ironworks.example",
    "Ironworks Gym <info@ironworks.example>",
    "Class timetable for June",
    "Sun, 01 Jun 2025 08:00:00 +0000",
    "New this month: Sunday morning yoga and a Thursday spin class.\n\nUnsubscribe from gym updates: https://ironworks.example/unsub",
  ],
  [
    "prize-claim@lucky-win.example",
    "Prize Desk <claims@lucky-win.example>",
    "Congratulations!!! Claim your prize now",
    "Wed, 04 Jun 2025 03:33:00 +0000",
    "You have been selected for a $1,000 gift card. Click within 24 hours to claim: http://lucky-win.example/claim",
  ],
];

function qp(s) {
  return Buffer.from(s, "latin1")
    .toString("latin1")
    .replace(
      /[=\u0080-\u00ff]/g,
      (c) => "=" + c.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0"),
    )
    .replace(/(.{1,72})/g, "$1=\n")
    .replace(/=\n$/, "");
}

function encodeSubject(s) {
  return /[^\x20-\x7e]/.test(s) ? `=?UTF-8?B?${Buffer.from(s, "utf8").toString("base64")}?=` : s;
}

function message([id, from, subject, date, body, opt = {}]) {
  const headers = [
    `Message-ID: <${id}>`,
    `From: ${from}`,
    `To: ${ME}`,
    `Subject: ${encodeSubject(subject)}`,
    `Date: ${date}`,
    "MIME-Version: 1.0",
  ];
  let text;
  if (opt.html) {
    // HTML-only mail, quoted-printable, with Latin-1 safe content (the &middot; stays an entity).
    headers.push(
      'Content-Type: text/html; charset="iso-8859-1"',
      "Content-Transfer-Encoding: quoted-printable",
    );
    text = qp(body);
  } else {
    headers.push('Content-Type: text/plain; charset="utf-8"', "Content-Transfer-Encoding: 8bit");
    text = body;
  }
  if (opt.attachments)
    headers.push(`X-Sample-Note: ${opt.attachments} photo attachments omitted from the sample`);
  return `${headers.join("\n")}\n\n${text}\n`;
}

function mboxrd(messages) {
  return messages
    .map((m) => {
      const escaped = m
        .slice(0, -1)
        .split("\n")
        .map((l) => (/^>*From /.test(l) ? `>${l}` : l))
        .join("\n");
      return `From MAILER-DAEMON Thu Jan  1 00:00:00 1970\n${escaped}\n\n`;
    })
    .join("");
}

mkdirSync(out, { recursive: true });
writeFileSync(resolve(out, "inbox.mbox"), mboxrd(mail.map(message)), "utf8");
console.log(`sample: ${mail.length} messages -> ${resolve(out, "inbox.mbox")}`);
