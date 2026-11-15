// @vitest-environment jsdom
import { render } from "@testing-library/react";
import axe from "axe-core";
import { describe, expect, it } from "vitest";
import {
  AppShell,
  Badge,
  Button,
  CommandPalette,
  EmptyState,
  Input,
  PaneHeader,
  SeanceProvider,
  SeanceTimeline,
} from "../src/index";
import { finishedRun, pendingRun } from "./fixtures";

/** Serious and critical axe violations. Contrast needs a real browser, so the e2e run covers it. */
async function seriousViolations(): Promise<string[]> {
  const result = await axe.run(document.body, { rules: { "color-contrast": { enabled: false } } });
  return result.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.id}: ${v.help} (${v.nodes.length})`);
}

describe("accessibility (axe, jsdom)", () => {
  it("app shell with library, timeline and a pending approval has no serious violations", async () => {
    render(
      <SeanceProvider>
        <AppShell
          title="Archive Séance"
          actions={<Badge tone="candle">Demo mode</Badge>}
          library={
            <>
              <PaneHeader title="Library" actions={<Button size="sm">Import</Button>} />
              <div className="p-3">
                <Input aria-label="Search conversations" placeholder="Search" />
              </div>
            </>
          }
          content={<EmptyState title="Nothing selected">Pick a conversation.</EmptyState>}
          agent={
            <SeanceTimeline
              entries={[...finishedRun, ...pendingRun.map((e) => ({ ...e, id: `p-${e.id}` }))]}
              onApprove={() => {}}
              onReject={() => {}}
              onUndo={() => {}}
            />
          }
        />
      </SeanceProvider>,
    );
    expect(await seriousViolations()).toEqual([]);
  });

  it("open command palette has no serious violations", async () => {
    render(
      <CommandPalette
        open
        onOpenChange={() => {}}
        commands={[
          { id: "a", label: "Import a file", group: "Library", shortcut: "⌘I", onSelect: () => {} },
          { id: "b", label: "Open settings", group: "App", onSelect: () => {} },
        ]}
      />,
    );
    expect(await seriousViolations()).toEqual([]);
  });
});
