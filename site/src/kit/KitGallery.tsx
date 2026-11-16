import {
  AppShell,
  Badge,
  Button,
  CommandPalette,
  EmptyState,
  Input,
  Kbd,
  kitMessages,
  PaneHeader,
  SeanceTimeline,
  TextArea,
  Tooltip,
  usePaletteHotkey,
  useT,
  type PaletteCommand,
  type TimelineEntry,
} from "@seance/ui";
import { useMemo, useState } from "react";
import { galleryMessages } from "../messages";
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
  const t = useT(galleryMessages);
  const kit = useT(kitMessages);
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
        label: t.showDestructive,
        group: t.groupGallery,
        keywords: ["banish", "delete", "hide"],
        onSelect: () =>
          setEntries((all) =>
            all.some((e) => e.id === banishStep.id) ? all : [...all, banishStep],
          ),
      },
      {
        id: "reset",
        label: t.resetRun,
        group: t.groupGallery,
        keywords: ["restart", "replay"],
        onSelect: () => {
          setEntries(galleryRun);
          setUndone(new Set());
        },
      },
      ...library.map((title) => ({
        id: `open-${title}`,
        label: title,
        group: t.groupLibrary,
        onSelect: () => setSelected(title),
      })),
    ],
    [t],
  );

  return (
    <>
      <AppShell
        title={t.title}
        mark={
          <span
            aria-hidden
            className="size-2 rounded-full bg-accent-solid shadow-[0_0_12px_var(--color-accent)]"
          />
        }
        actions={
          <Button variant="ghost" size="sm" onClick={() => setPaletteOpen(true)}>
            {t.commands} <Kbd>⌘K</Kbd>
          </Button>
        }
        library={
          <>
            <PaneHeader title={t.library} actions={<Button size="sm">{t.import}</Button>} />
            <div className="p-3">
              <Input aria-label={t.searchLibrary} placeholder={t.search} />
            </div>
            <ul className="px-2 pb-4">
              {library.map((title) => (
                <li key={title}>
                  <button
                    type="button"
                    onClick={() => setSelected(title)}
                    aria-current={selected === title ? "true" : undefined}
                    className="w-full rounded-md px-3 py-2 text-left text-sm text-fg hover:bg-raised aria-[current=true]:bg-raised aria-[current=true]:text-accent"
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
                {t.buttons}
              </h2>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Button variant="primary">{t.resurrect}</Button>
                <Button>{t.import}</Button>
                <Tooltip content={t.banishTip}>
                  <Button variant="danger">{t.banish}</Button>
                </Tooltip>
                <Button variant="ghost">{t.cancel}</Button>
                <Button disabled>{t.disabled}</Button>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Badge>reads</Badge>
                <Badge tone="warn">writes</Badge>
                <Badge tone="danger">hides</Badge>
                <Badge tone="accent">{t.realProvider}</Badge>
              </div>
            </section>
            <section aria-labelledby="kit-fields">
              <h2 id="kit-fields" className="text-lg font-semibold">
                {t.fields}
              </h2>
              <div className="mt-4 space-y-3">
                <Input aria-label={t.exampleInput} placeholder={t.exampleInputPh} />
                <TextArea aria-label={t.exampleArea} placeholder={t.exampleAreaPh} />
              </div>
            </section>
            <section aria-labelledby="kit-empty" className="rounded-lg border border-line">
              <h2 id="kit-empty" className="sr-only">
                {t.emptyHeading}
              </h2>
              <EmptyState
                title={t.noChats}
                action={<Button variant="primary">{t.importExport}</Button>}
              >
                {t.emptyText}
              </EmptyState>
            </section>
          </div>
        }
        agent={
          <>
            <PaneHeader title={kit.seance} />
            <SeanceTimeline
              entries={entries}
              onApprove={(id) => settle(id, true)}
              onReject={(id) => settle(id, false)}
              onUndo={(token) => setUndone((s) => new Set([...s, token]))}
              undone={undone}
              toolLabels={{ banish_conversation: t.hideChats, tag_conversation: t.addTags }}
              describeApproval={(step) =>
                step.risk === "destructive"
                  ? {
                      summary: t.hideN(banishTitles.length),
                      details: (
                        <ul className="list-disc space-y-1 pl-5 text-fg">
                          {banishTitles.map((title) => (
                            <li key={title}>{title}</li>
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
