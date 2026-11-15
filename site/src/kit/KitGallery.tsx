import {
  AppShell,
  Badge,
  Button,
  CommandPalette,
  EmptyState,
  Input,
  Kbd,
  PaneHeader,
  SeanceTimeline,
  TextArea,
  Tooltip,
  usePaletteHotkey,
  type PaletteCommand,
  type TimelineEntry,
} from "@seance/ui";
import { useMemo, useState } from "react";
import { banishStep, banishTitles, galleryRun } from "./fixtures";

const library = [
  "Starter keeps dying",
  "Trip planning: Lisbon",
  "Regex for dates",
  "Birthday poem",
];

/**
 * Live gallery of the shared UI kit. It uses canned timeline data, not an agent, so there is no
 * Demo-mode badge here. The badge belongs to screens that run the agent.
 */
export function KitGallery() {
  const [entries, setEntries] = useState<TimelineEntry[]>(galleryRun);
  const [undone, setUndone] = useState<ReadonlySet<string>>(new Set());
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [selected, setSelected] = useState(library[0]);
  usePaletteHotkey(setPaletteOpen);

  const settle = (id: string, approved: boolean) =>
    setEntries((all) =>
      all.map((e) =>
        e.kind === "tool" && e.id === id
          ? approved
            ? {
                ...e,
                status: "done",
                durationMs: 12,
                output: e.risk === "destructive" ? { undoToken: `undo-${id}` } : { ok: true },
                ...(e.risk === "destructive" ? { undoToken: `undo-${id}` } : {}),
              }
            : {
                ...e,
                status: "rejected",
                durationMs: 900,
                error: { type: "Rejected", message: "The user rejected this action" },
              }
          : e,
      ),
    );

  const commands: PaletteCommand[] = useMemo(
    () => [
      {
        id: "ask-banish",
        label: "Show a destructive approval",
        group: "Gallery",
        keywords: ["banish", "delete", "hide"],
        onSelect: () =>
          setEntries((all) =>
            all.some((e) => e.id === banishStep.id) ? all : [...all, banishStep],
          ),
      },
      {
        id: "reset",
        label: "Reset the run",
        group: "Gallery",
        keywords: ["restart", "replay"],
        onSelect: () => {
          setEntries(galleryRun);
          setUndone(new Set());
        },
      },
      ...library.map((title) => ({
        id: `open-${title}`,
        label: title,
        group: "Library",
        onSelect: () => setSelected(title),
      })),
    ],
    [],
  );

  return (
    <>
      <AppShell
        title="UI kit"
        mark={
          <span
            aria-hidden
            className="size-2 rounded-full bg-ecto shadow-[0_0_12px_var(--color-ecto)]"
          />
        }
        actions={
          <Button variant="ghost" size="sm" onClick={() => setPaletteOpen(true)}>
            Commands <Kbd>⌘K</Kbd>
          </Button>
        }
        library={
          <>
            <PaneHeader title="Library" actions={<Button size="sm">Import</Button>} />
            <div className="p-3">
              <Input aria-label="Search the library" placeholder="Search…" />
            </div>
            <ul className="px-2 pb-4">
              {library.map((title) => (
                <li key={title}>
                  <button
                    type="button"
                    onClick={() => setSelected(title)}
                    aria-current={selected === title ? "true" : undefined}
                    className="w-full rounded-md px-3 py-2 text-left text-sm text-fg hover:bg-raised aria-[current=true]:bg-raised aria-[current=true]:text-ecto"
                  >
                    {title}
                  </button>
                </li>
              ))}
            </ul>
          </>
        }
        content={
          <div className="mx-auto max-w-2xl space-y-10 px-8 py-10">
            <section aria-labelledby="kit-buttons">
              <h2 id="kit-buttons" className="text-lg font-semibold">
                Buttons and badges
              </h2>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Button variant="primary">Resurrect</Button>
                <Button>Import</Button>
                <Tooltip content="Hides the chat. Nothing is deleted, and you can undo it.">
                  <Button variant="danger">Banish</Button>
                </Tooltip>
                <Button variant="ghost">Cancel</Button>
                <Button disabled>Disabled</Button>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Badge>reads</Badge>
                <Badge tone="candle">writes</Badge>
                <Badge tone="blood">hides</Badge>
                <Badge tone="ecto">Real provider</Badge>
              </div>
            </section>
            <section aria-labelledby="kit-fields">
              <h2 id="kit-fields" className="text-lg font-semibold">
                Fields
              </h2>
              <div className="mt-4 space-y-3">
                <Input aria-label="Example input" placeholder="Ask about your archive…" />
                <TextArea aria-label="Example text area" placeholder="Longer notes" />
              </div>
            </section>
            <section aria-labelledby="kit-empty" className="rounded-lg border border-line">
              <h2 id="kit-empty" className="sr-only">
                Empty state
              </h2>
              <EmptyState
                title="No chats yet"
                action={<Button variant="primary">Import an export</Button>}
              >
                Drop a ChatGPT or Claude export here. It stays in this browser.
              </EmptyState>
            </section>
          </div>
        }
        agent={
          <>
            <PaneHeader title="Séance" />
            <SeanceTimeline
              entries={entries}
              onApprove={(id) => settle(id, true)}
              onReject={(id) => settle(id, false)}
              onUndo={(token) => setUndone((s) => new Set([...s, token]))}
              undone={undone}
              toolLabels={{ banish_conversation: "Hide chats", tag_conversation: "Add tags" }}
              describeApproval={(step) =>
                step.risk === "destructive"
                  ? {
                      summary: `Hide ${banishTitles.length} chats. Nothing is deleted, and you can undo it.`,
                      details: (
                        <ul className="list-disc space-y-1 pl-5 text-fg">
                          {banishTitles.map((t) => (
                            <li key={t}>{t}</li>
                          ))}
                        </ul>
                      ),
                    }
                  : undefined
              }
            />
          </>
        }
      />
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} commands={commands} />
    </>
  );
}
