// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  CommandPalette,
  isPaletteHotkey,
  usePaletteHotkey,
  type PaletteCommand,
} from "../src/index";

function Harness({ commands }: { commands: PaletteCommand[] }) {
  const [open, setOpen] = useState(false);
  usePaletteHotkey(setOpen);
  return <CommandPalette open={open} onOpenChange={setOpen} commands={commands} />;
}

describe("isPaletteHotkey", () => {
  const key = (k: Partial<KeyboardEvent>) => ({
    key: "k",
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    ...k,
  });
  it("accepts ⌘K and Ctrl+K only", () => {
    expect(isPaletteHotkey(key({ metaKey: true }))).toBe(true);
    expect(isPaletteHotkey(key({ ctrlKey: true, key: "K" }))).toBe(true);
    expect(isPaletteHotkey(key({}))).toBe(false);
    expect(isPaletteHotkey(key({ metaKey: true, shiftKey: true }))).toBe(false);
    expect(isPaletteHotkey(key({ metaKey: true, key: "j" }))).toBe(false);
  });
});

describe("CommandPalette", () => {
  it("opens on Ctrl+K, filters by label and keywords, and runs the chosen command", async () => {
    const banish = vi.fn();
    const importFile = vi.fn();
    render(
      <Harness
        commands={[
          { id: "import", label: "Import a file", group: "Library", onSelect: importFile },
          {
            id: "banish",
            label: "Banish selected",
            group: "Library",
            keywords: ["delete", "hide"],
            onSelect: banish,
          },
        ]}
      />,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    await userEvent.keyboard("{Control>}k{/Control}");
    expect(screen.getByRole("dialog", { name: "Command palette" })).toBeTruthy();

    await userEvent.keyboard("delete");
    expect(screen.queryByText("Import a file")).toBeNull();
    expect(screen.getByText("Banish selected")).toBeTruthy();

    await userEvent.keyboard("{Enter}");
    expect(banish).toHaveBeenCalledOnce();
    expect(importFile).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("toggles closed with the same hotkey and says so when nothing matches", async () => {
    render(<Harness commands={[{ id: "a", label: "Alpha", onSelect: () => {} }]} />);
    await userEvent.keyboard("{Meta>}k{/Meta}");
    await userEvent.keyboard("zzz");
    expect(screen.getByText("Nothing matches. Try a plainer word.")).toBeTruthy();
    await userEvent.keyboard("{Meta>}k{/Meta}");
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
