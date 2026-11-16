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
import { Library, EMPTY_FILTERS, type Filters } from "./components/Library";
import { ArchiveEmpty, Reader } from "./components/Reader";
import { DEMO_PROMPTS } from "./demo/scripts";
import { ARCHIVE_SYSTEM_PROMPT } from "./tools";
import { fetchSampleFiles, mock, registry, sampleUrl, search, storage } from "./runtime";
import { useArchive, useImporter } from "./useArchive";

const ACCEPT = ".json,.zip,.md,.markdown,.txt";

function Workspace() {
  const toast = useToast();
  const { provider, isMock } = useProviderMode();
  const data = useArchive();
  const importer = useImporter(data.refresh);
  const agent = useAgentRun({
    provider,
    registry,
    storage,
    system: ARCHIVE_SYSTEM_PROMPT,
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
      await importer.importFiles(await fetchSampleFiles());
    } catch (err) {
      toast({ text: err instanceof Error ? err.message : String(err), tone: "error" });
    }
  }, [importer, toast]);

  // "/" focuses search, like most list apps.
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
      setFilters((f) => ({ ...f, view: "active" }));
      searchInput.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Drop files anywhere to import them.
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
        label: "Import files…",
        group: "Library",
        keywords: ["upload", "open", "zip", "json"],
        onSelect: pickFiles,
      },
      {
        id: "sample",
        label: "Load the sample archive",
        group: "Library",
        keywords: ["demo", "example"],
        onSelect: () => void loadSample(),
      },
      {
        id: "search",
        label: "Search chats",
        group: "Library",
        shortcut: "/",
        keywords: ["find"],
        onSelect: () => {
          setFilters((f) => ({ ...f, view: "active" }));
          setTimeout(() => searchInput.current?.focus(), 0);
        },
      },
      {
        id: "banished",
        label: filters.view === "banished" ? "Back to the library" : "Show banished chats",
        group: "Library",
        keywords: ["hidden", "deleted", "trash", "restore"],
        onSelect: () =>
          setFilters((f) => ({
            ...EMPTY_FILTERS,
            view: f.view === "banished" ? "active" : "banished",
          })),
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
    [pickFiles, loadSample, filters.view, agent, empty],
  );

  return (
    <>
      <AppShell
        title="Archive Séance"
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
        library={
          <Library
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
              <ArchiveEmpty
                onSample={() => void loadSample()}
                onPick={pickFiles}
                loading={importer.busy}
              />
              <p className="-mt-8 text-xs text-muted">
                Want to try the drag-and-drop?{" "}
                <a
                  className="text-ecto underline underline-offset-4"
                  href={sampleUrl("chatgpt-conversations.json")}
                  download
                >
                  Download a sample export
                </a>
                .
              </p>
            </div>
          ) : (
            <Reader
              conversation={selected}
              version={data.version}
              onChanged={data.refresh}
              empty={
                <EmptyState title="Pick a chat">
                  Choose one from the library, or ask the agent on the right.
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
              ChatGPT or Claude exports, .zip or .json, and Markdown. Files stay in this browser.
            </p>
          </div>
        </div>
      )}

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} commands={commands} />
      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        exportName="archive-seance"
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
