// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  SeanceProvider,
  SeanceTimeline,
  timelineStatus,
  type SeanceTimelineProps,
} from "../src/index";
import { finishedRun, pendingRun } from "./fixtures";

function renderTimeline(
  props: Partial<SeanceTimelineProps> & Pick<SeanceTimelineProps, "entries">,
) {
  const handlers = { onApprove: vi.fn(), onReject: vi.fn(), onUndo: vi.fn() };
  const utils = render(
    <SeanceProvider>
      <SeanceTimeline {...handlers} {...props} />
    </SeanceProvider>,
  );
  return { ...handlers, ...utils };
}

describe("SeanceTimeline", () => {
  it("renders prompt, steps with risk and status, and the reply in order", () => {
    renderTimeline({ entries: finishedRun });
    const items = within(screen.getByRole("list", { name: "Agent run" })).getAllByRole("listitem");
    expect(items).toHaveLength(5);
    expect(items[0]?.textContent).toContain("Summarize my oldest chats");
    expect(items[1]?.textContent).toContain("search_conversations");
    expect(items[1]?.textContent).toContain("reads");
    expect(items[1]?.textContent).toContain("42 ms");
    expect(items[2]?.textContent).toContain("hides");
    expect(items[3]?.textContent).toContain("Rejected");
    expect(items[3]?.textContent).toContain("1.2 s");
    expect(items[4]?.textContent).toContain("Here are your three oldest chats.");
  });

  it("offers Undo only on finished destructive steps, and shows Restored after undo", async () => {
    const { onUndo, rerender } = renderTimeline({ entries: finishedRun });
    const undo = screen.getAllByRole("button", { name: "Undo" });
    expect(undo).toHaveLength(1);
    await userEvent.click(undo[0]!);
    expect(onUndo).toHaveBeenCalledWith("undo-1");

    rerender(
      <SeanceProvider>
        <SeanceTimeline
          entries={finishedRun}
          onApprove={() => {}}
          onReject={() => {}}
          onUndo={onUndo}
          undone={new Set(["undo-1"])}
        />
      </SeanceProvider>,
    );
    expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
    expect(screen.getByText("Restored")).toBeTruthy();
  });

  it("shows an approval card for a pending step and routes Allow and Reject by call id", async () => {
    const { onApprove, onReject } = renderTimeline({
      entries: pendingRun,
      describeApproval: () => ({
        summary: "Hide 2 emails. You can undo this.",
        details: (
          <ul>
            <li>Weekly digest</li>
            <li>Flash sale</li>
          </ul>
        ),
      }),
    });
    const card = screen.getByRole("group", { name: /Allow banish_emails/ });
    expect(card?.textContent).toContain("Hide 2 emails. You can undo this.");
    expect(card?.textContent).toContain("Flash sale");

    await userEvent.click(within(card).getByRole("button", { name: "Allow" }));
    expect(onApprove).toHaveBeenCalledWith("c9");
    await userEvent.click(within(card).getByRole("button", { name: "Reject" }));
    expect(onReject).toHaveBeenCalledWith("c9");
  });

  it("focuses the card, not Allow, so Enter cannot approve by accident, and Esc rejects", async () => {
    const { onApprove, onReject } = renderTimeline({ entries: pendingRun });
    const card = screen.getByRole("group", { name: /Allow banish_emails/ });
    expect(document.activeElement).toBe(card);
    await userEvent.keyboard("{Enter}");
    expect(onApprove).not.toHaveBeenCalled();
    await userEvent.keyboard("{Escape}");
    expect(onReject).toHaveBeenCalledWith("c9");
  });

  it("announces what the agent waits for in a polite live region", () => {
    renderTimeline({ entries: pendingRun, toolLabels: { banish_emails: "Hide emails" } });
    expect(screen.getByRole("status")?.textContent).toContain(
      "Waiting for your approval: Hide emails",
    );
    expect(timelineStatus(finishedRun)).toBe("Agent: Here are your three oldest chats.");
  });

  it("shows the empty state when there are no entries", () => {
    renderTimeline({ entries: [], empty: <p>Ask the spirits something.</p> });
    expect(screen.getByText("Ask the spirits something.")).toBeTruthy();
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("styles the pending card so reduced motion swaps the pulse for a static ring", () => {
    renderTimeline({ entries: pendingRun });
    const card = screen.getByRole("group", { name: /Allow banish_emails/ });
    expect(card.className).toContain("motion-safe:animate-candle-pulse");
    expect(card.className).toContain("motion-reduce:ring-2");
  });
});
