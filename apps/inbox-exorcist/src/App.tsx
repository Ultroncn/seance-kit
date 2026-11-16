import { useAgentRun } from "@seance/react";
import {
  AppShell,
  Button,
  CommandPalette,
  DemoBadge,
  EmptyState,
  Kbd,
  ProviderModeProvider,
  SeanceProvider,
  SettingsDialog,
  ToastProvider,
  usePaletteHotkey,
  useProviderMode,
  useToast,
  type PaletteCommand,
} from "@seance/ui";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AgentPane } from "./components/AgentPane";
import { EMPTY_FILTERS, MailList, type Filters } from "./components/MailList";
import { InboxEmpty, MailReader } from "./components/MailReader";
import { DEMO_PROMPTS } from "./demo/scripts";
import { CATEGORIES, CATEGORY_LABEL } from "./domain/types";
import { fetchSampleFile, mock, registry, sampleUrl, search, storage } from "./runtime";
import { INBOX_SYSTEM_PROMPT } from "./tools";
import { useImporter, useInbox } from "./useInbox";

const ACCEPT = ".mbox,.mbx,.eml,.zip";

function Workspace() {
  const toast = useToast();
  const { provider, isMock } = useProviderMode();
  const data = useInbox();
  const importer = useImporter(data.refresh);
  const agent = useAgentRun({
    provider,
    registry,
    storage,
    system: INBOX_SYSTEM_PROMPT,
    onDataChange: data.refresh,
  });

  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  usePaletteHotkey(setPaletteOpen);

  const pickFiles = useCallback(() => fileInput.current?.click(), []);
  const loadSample = useCallback(async () => {
    try {
      await importer.importFiles([await fetchSampleFile()]);
    } catch (err) {
      toast({ text: err instanceof Error ? err.message : String(err), tone: "error" });
    }
  }, [importer, toast]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (
        e.key !== "/" ||
        e.metaKey ||
        e.ctrlKey ||
        el?.closest("input, textarea, select, [contenteditable]")
      )
        return;
      e.preventDefault();
      setFilters((f) => ({ ...f, view: "inbox" }));
      setTimeout(() => searchInput.current?.focus(), 0);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    let depth = 0;
    const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes("Files");
    const enter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth++;
      setDragging(true);
    };
    const leave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragging(false);
    };
    const over = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault();
    };
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setDragging(false);
      void importer.importFiles(Array.from(e.dataTransfer?.files ?? []));
    };
    window.addEventListener("dragenter", enter);
    window.addEventListener("dragleave", leave);
    window.addEventListener("dragover", over);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragenter", enter);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("dragover", over);
      window.removeEventListener("drop", drop);
    };
  }, [importer]);

  const selected = selectedId ? data.byId.get(selectedId) : undefined;
  const empty = data.all !== null && data.all.length === 0;

  const commands: PaletteCommand[] = useMemo(
    () => [
      {
        id: "import",
        label: "Import mail…",
        group: "Inbox",
        keywords: ["mbox", "eml", "upload", "takeout"],
        onSelect: pickFiles,
      },
      {
        id: "sample",
        label: "Load the sample inbox",
        group: "Inbox",
        keywords: ["demo", "example"],
        onSelect: () => void loadSample(),
      },
      {
        id: "search",
        label: "Search mail",
        group: "Inbox",
        shortcut: "/",
        keywords: ["find"],
        onSelect: () => {
          setFilters((f) => ({ ...f, view: "inbox" }));
          setTimeout(() => searchInput.current?.focus(), 0);
        },
      },
      ...CATEGORIES.map((c) => ({
        id: `cat-${c}`,
        label: `Show ${CATEGORY_LABEL[c].toLowerCase()}`,
        group: "Filter",
        onSelect: () => setFilters({ ...EMPTY_FILTERS, category: c }),
      })),
      {
        id: "drafts",
        label: "Show drafts",
        group: "Views",
        keywords: ["replies"],
        onSelect: () => setFilters({ ...EMPTY_FILTERS, view: "drafts" }),
      },
      {
        id: "banished",
        label: "Show banished mail",
        group: "Views",
        keywords: ["hidden", "deleted", "trash", "restore"],
        onSelect: () => setFilters({ ...EMPTY_FILTERS, view: "banished" }),
      },
      ...Object.values(DEMO_PROMPTS).map((p) => ({
        id: `ask-${p}`,
        label: p,
        group: "Ask the agent",
        disabled: agent.busy || empty,
        onSelect: () => void agent.run(p),
      })),
      {
        id: "new",
        label: "New séance",
        group: "Agent",
        keywords: ["reset", "clear"],
        onSelect: agent.reset,
      },
      {
        id: "settings",
        label: "Open settings",
        group: "App",
        keywords: ["provider", "api key", "model", "export", "delete"],
        onSelect: () => setSettingsOpen(true),
      },
    ],
    [pickFiles, loadSample, agent, empty],
  );

  return (
    <>
      <AppShell
        title="Inbox Exorcist"
        mark={
          <span
            aria-hidden
            className="size-2 rounded-full bg-ecto shadow-[0_0_12px_var(--color-ecto)]"
          />
        }
        actions={
          <>
            <DemoBadge onClick={() => setSettingsOpen(true)} />
            <Button variant="ghost" size="sm" onClick={() => setPaletteOpen(true)}>
              Commands <Kbd>⌘K</Kbd>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSettingsOpen(true)}>
              Settings
            </Button>
          </>
        }
        labels={{ library: "Mailbox" }}
        library={
          <MailList
            ref={searchInput}
            data={data}
            filters={filters}
            onFilters={setFilters}
            selectedId={selectedId}
            onSelect={setSelectedId}
            importer={importer}
            onPickFiles={pickFiles}
          />
        }
        content={
          empty ? (
            <div className="flex h-full flex-col items-center justify-center">
              <InboxEmpty
                onSample={() => void loadSample()}
                onPick={pickFiles}
                loading={importer.busy}
              />
              <p className="-mt-8 text-xs text-muted">
                Want to try the drag-and-drop?{" "}
                <a className="text-ecto underline underline-offset-4" href={sampleUrl()} download>
                  Download the sample .mbox
                </a>
                .
              </p>
            </div>
          ) : (
            <MailReader
              key={selected?.id ?? "none"}
              email={selected}
              drafts={data.drafts}
              onChanged={data.refresh}
              empty={
                <EmptyState title="Pick an email">
                  Choose one from the list, or ask the agent on the right.
                </EmptyState>
              }
            />
          )
        }
        agent={
          <AgentPane
            agent={agent}
            isMock={isMock}
            byId={data.byId}
            hasData={!empty && data.all !== null}
          />
        }
      />

      <input
        ref={fileInput}
        type="file"
        accept={ACCEPT}
        multiple
        hidden
        data-testid="file-input"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          void importer.importFiles(files);
        }}
      />

      {dragging && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-bg/80 backdrop-blur-sm">
          <div className="rounded-2xl border-2 border-dashed border-ecto/70 px-12 py-10 text-center">
            <p className="text-lg font-semibold text-ecto">Drop to import</p>
            <p className="mt-1 text-sm text-muted">
              .mbox, .eml, or a .zip of them. Mail stays in this browser.
            </p>
          </div>
        </div>
      )}

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} commands={commands} />
      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        exportName="inbox-exorcist"
        onAfterWipe={() => {
          setSelectedId(null);
          agent.reset();
          void search.rebuild().then(data.refresh);
        }}
      />
    </>
  );
}

export function App() {
  return (
    <SeanceProvider>
      <ProviderModeProvider storage={storage} mock={mock}>
        <ToastProvider>
          <Workspace />
        </ToastProvider>
      </ProviderModeProvider>
    </SeanceProvider>
  );
}
