// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import {
  paletteScore,
  SeanceProvider,
  SeanceTimeline,
  timelineStatus,
  type TimelineEntry,
} from "../src/index";
import { pendingRun } from "./fixtures";

describe("review regressions: UI kit", () => {
  it("ranks a word-start match above a match inside a word", () => {
    expect(paletteScore("Open settings", "set")).toBeGreaterThan(
      paletteScore("New séance", "set", ["reset", "clear"]),
    );
  });

  it("does not dim rejected steps (dimmed text fails contrast)", () => {
    const rejected: TimelineEntry[] = [
      {
        kind: "tool",
        id: "c1",
        name: "tag_x",
        input: {},
        risk: "write",
        status: "rejected",
        durationMs: 1,
      },
    ];
    render(<SeanceTimeline entries={rejected} onApprove={() => {}} onReject={() => {}} />);
    const item = screen.getByRole("listitem");
    expect(item.innerHTML).not.toMatch(/opacity-\d/);
  });

  it("keeps keyboard focus in the timeline after Allow or Reject", async () => {
    function Harness() {
      const [entries, setEntries] = useState<TimelineEntry[]>(pendingRun);
      const settle = () =>
        setEntries((all) => all.map((e) => (e.kind === "tool" ? { ...e, status: "rejected" } : e)));
      return (
        <SeanceProvider>
          <SeanceTimeline entries={entries} onApprove={settle} onReject={settle} />
        </SeanceProvider>
      );
    }
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: "Reject" }));
    await act(() => new Promise((r) => setTimeout(r, 30)));
    expect(document.activeElement).toBe(screen.getByRole("list", { name: "Agent run" }));
  });

  it("announces the agent's latest reply to screen readers", () => {
    expect(timelineStatus([{ kind: "message", id: "m1", text: "Tagged 3 chats." }])).toBe(
      "Agent: Tagged 3 chats.",
    );
  });

  it("gives input borders at least 3:1 contrast against the panes (WCAG 1.4.11)", () => {
    const css = readFileSync(resolve(import.meta.dirname, "../src/tokens.css"), "utf8");
    const hex = (n: string) =>
      css.match(new RegExp(`--color-${n}:\\s*(#[0-9a-fA-F]{6})`))?.[1] ?? "";
    const lum = (h: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => {
        const c = parseInt(h.slice(i, i + 2), 16) / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      }) as [number, number, number];
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const ratio = (a: string, b: string) =>
      (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
    for (const bg of ["bg", "surface"])
      expect(ratio(hex("edge"), hex(bg))).toBeGreaterThanOrEqual(3);
    const primitives = readFileSync(resolve(import.meta.dirname, "../src/primitives.tsx"), "utf8");
    expect(primitives).toMatch(/fieldClass =[\s\S]*border-edge/);
  });
});
