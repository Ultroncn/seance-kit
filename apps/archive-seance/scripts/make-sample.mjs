#!/usr/bin/env node
// Generates the fictional sample archive in public/sample/ in the real ChatGPT and Claude export
// formats. All people, places and details are made up. Run: node scripts/make-sample.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const out = resolve(import.meta.dirname, "../public/sample");

/** [title, ISO start, [user, assistant, user, assistant, ...]] */
const chatgpt = [
  [
    "Sourdough starter keeps dying",
    "2019-04-12T18:20:00Z",
    [
      "My sourdough starter smells like nail polish and barely rises. Day 9. What am I doing wrong?",
      "That acetone smell means the starter is hungry. Feed it twice a day at 1:1:1 (starter, flour, water by weight), keep it somewhere around 24–26 °C, and swap a quarter of the flour for whole rye. Rye gives the yeast more to eat.",
      "My kitchen is cold. Around 18 °C.",
      "Then use the oven with only the light on, or a spot on top of the fridge. At 18 °C a starter can take two weeks to settle. It is not dead, just slow.",
    ],
  ],
  ["Untitled chat", "2019-11-03T09:01:00Z", ["test", "Hello! How can I help you today?"]],
  [
    "Regex for dates in a log file",
    "2020-06-21T14:05:00Z",
    [
      "I need a regex that finds dates like 2020-06-21 in a server log.",
      "Use \\b\\d{4}-\\d{2}-\\d{2}\\b. It matches four digits, a dash, two digits, a dash and two digits, as a whole word.",
      "It also matches 2020-13-45. Can it reject impossible months?",
      "Yes: \\b\\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\\d|3[01])\\b. It still allows 31 February, so check real dates in code if that matters.",
    ],
  ],
  [
    "Birthday poem for Grandma Rosa",
    "2021-02-14T20:30:00Z",
    [
      "Write a short, warm birthday poem for my grandmother Rosa. She is turning 90, loves her garden and makes the best plum cake.",
      "Ninety summers in the garden, / ninety springs of plum and rose, / every cake a quiet kindness / only family ever knows. / Happy birthday, Grandma Rosa, / may the blossoms find you still: / the warm kitchen, the open window, / and the plums upon the sill.",
    ],
  ],
  [
    "Lisbon trip planning",
    "2022-09-30T07:45:00Z",
    [
      "Plan four days in Lisbon in late September. I like walking, viewpoints and food, not museums.",
      "Day 1: Alfama on foot, Miradouro de Santa Luzia at sunset. Day 2: Belém in the morning for pastéis de nata, LX Factory in the afternoon. Day 3: day trip to Sintra, start early to beat the crowds at Pena Palace. Day 4: Bairro Alto and Príncipe Real, dinner in Cais do Sodré.",
      "Is tram 28 worth it?",
      "It is charming but packed. Ride it early in the morning from Martim Moniz, or walk the same route. Buy a Viva Viagem card for trams and the metro.",
    ],
  ],
  [
    "Tomatoes splitting on the vine",
    "2023-03-08T16:10:00Z",
    [
      "My tomatoes keep splitting right before they ripen. Why?",
      "Usually uneven watering: the plant dries out, then a big drink swells the fruit faster than the skin can stretch. Water deeply on a schedule, mulch the soil, and pick fruit at the first blush before heavy rain.",
    ],
  ],
  [
    "Haunted house story for the kids",
    "2023-10-28T19:00:00Z",
    [
      "Give me a not-too-scary haunted house story for a 6 and an 8 year old, for Halloween night.",
      "The ghost of Willow Lane only wanted someone to share her lantern with. Every Halloween she floated from window to window, a little lonely, until two brave children knocked on her door with an extra pumpkin. From then on, the house on Willow Lane glowed the brightest on the whole street.",
      "Can you add a twist at the end?",
      "Twist: the ghost was their great-great-aunt, and the lantern had been in the family attic all along. That night they found it, dusty and warm, as if someone had just set it down.",
    ],
  ],
  [
    "test test 123",
    "2024-05-17T11:11:00Z",
    [
      "test test 123",
      "It looks like you are checking that I work. I do! What would you like to talk about?",
    ],
  ],
];

const claude = [
  [
    "useEffect runs twice in dev",
    "2024-01-09T10:00:00Z",
    [
      "My React useEffect fetch runs twice on page load. Is that a bug?",
      "In development, React StrictMode mounts, unmounts and mounts components again to surface effects that do not clean up. Production runs it once. Return a cleanup function, for example an AbortController that cancels the first fetch.",
    ],
  ],
  [
    "Budget spreadsheet: SUMIF by month",
    "2024-07-22T08:00:00Z",
    [
      "In Google Sheets I have dates in column A and amounts in column B. How do I total one month?",
      'Use =SUMIFS(B:B, A:A, ">="&DATE(2024,7,1), A:A, "<"&DATE(2024,8,1)). Put the month start in a cell and use EDATE(cell, 1) for the end to reuse it.',
    ],
  ],
  [
    "Interview prep: system design",
    "2025-02-03T17:30:00Z",
    [
      "I have a system design interview on Friday. What should I practise?",
      "Pick three classics: a URL shortener, a news feed and a chat service. For each, practise requirements, rough capacity numbers, a simple design first, then bottlenecks: caching, queues, sharding. Speak your trade-offs out loud.",
      "How long should I spend on requirements?",
      "About five minutes. Agree on scale, read/write ratio and what can be eventually consistent before drawing any boxes.",
    ],
  ],
  [
    "Learning Portuguese before Lisbon",
    "2025-06-15T06:50:00Z",
    [
      "Teach me ten Portuguese phrases for ordering food in Lisbon.",
      "Bom dia (good morning). Uma bica, por favor (an espresso, please). Um pastel de nata (a custard tart). A conta, por favor (the bill, please). Obrigado / obrigada (thank you, said by a man / woman). Tem mesa para dois? (a table for two?). Sem glúten (gluten free). Água sem gás (still water). Está delicioso (it is delicious). Até logo (see you later).",
    ],
  ],
];

const sec = (iso, plus = 0) => Date.parse(iso) / 1000 + plus;

function toChatGPT([title, start, turns], i) {
  const id = `sample-chatgpt-${String(i + 1).padStart(2, "0")}`;
  const mapping = { root: { id: "root", message: null, parent: null, children: ["n0"] } };
  turns.forEach((text, k) => {
    mapping[`n${k}`] = {
      id: `n${k}`,
      parent: k === 0 ? "root" : `n${k - 1}`,
      children: k < turns.length - 1 ? [`n${k + 1}`] : [],
      message: {
        id: `n${k}`,
        author: { role: k % 2 === 0 ? "user" : "assistant" },
        create_time: sec(start, k * 40),
        content: { content_type: "text", parts: [text] },
        metadata: {},
      },
    };
  });
  return {
    id,
    title,
    create_time: sec(start),
    update_time: sec(start, turns.length * 40),
    current_node: `n${turns.length - 1}`,
    mapping,
  };
}

function toClaude([name, start, turns], i) {
  const at = (k) => new Date(Date.parse(start) + k * 40_000).toISOString();
  return {
    uuid: `sample-claude-${String(i + 1).padStart(2, "0")}`,
    name,
    created_at: start,
    updated_at: at(turns.length),
    chat_messages: turns.map((text, k) => ({
      uuid: `m${k}`,
      sender: k % 2 === 0 ? "human" : "assistant",
      text,
      created_at: at(k),
    })),
  };
}

mkdirSync(out, { recursive: true });
writeFileSync(
  resolve(out, "chatgpt-conversations.json"),
  JSON.stringify(chatgpt.map(toChatGPT), null, 1) + "\n",
);
writeFileSync(
  resolve(out, "claude-conversations.json"),
  JSON.stringify(claude.map(toClaude), null, 1) + "\n",
);
console.log(`sample: ${chatgpt.length} ChatGPT + ${claude.length} Claude conversations -> ${out}`);
