import { useAgentRun } from "@seance/react";
import { Settings } from "lucide-react";
import {
  BrandMark,
  CommandPalette,
  CommandTrigger,
  DemoBadge,
  EmptyState,
  IconButton,
  ProviderModeProvider,
  ResizablePaneLayout,
  SeanceProvider,
  SettingsDialog,
  ToastProvider,
  kitMessages,
  usePaletteHotkey,
  useProviderCommands,
  useProviderMode,
  useResizablePaneWidths,
  useT,
  useToast,
  withReplyLanguage,
  type PaletteCommand,
} from "@seance/ui";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AgentPane } from "./components/AgentPane";
import { Library, EMPTY_FILTERS, type Filters } from "./components/Library";
import { ArchiveEmpty, Reader } from "./components/Reader";
import { ARCHIVE_SYSTEM_PROMPT } from "./tools";
import { archiveDemoMessages, archiveMessages } from "./messages";
import { fetchSampleFiles, mock, registry, sampleUrl, search, storage } from "./runtime";
import { useArchive, useImporter } from "./useArchive";

const ACCEPT = ".json,.zip,.md,.markdown,.txt";
const PANE_WIDTHS_KEY = "archive-seance-pane-widths";

function Workspace() {
  const toast = useToast();
  const t = useT(archiveMessages);
  const kit = useT(kitMessages);
  const prompts = useT(archiveDemoMessages).prompts;
  const { leftWidth, rightWidth } = useResizablePaneWidths(PANE_WIDTHS_KEY);

  // The tab title follows the language too.
  useEffect(() => {
    document.title = t.appTitle;
  }, [t.appTitle]);
  const { provider, isMock } = useProviderMode();
  const providerCommands = useProviderCommands();
  const data = useArchive();
  const importer = useImporter(data.refresh);
  const agent = useAgentRun({
    provider,
    registry,
    storage,
    system: withReplyLanguage(ARCHIVE_SYSTEM_PROMPT),
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

  // Stable refs, so the window drag-and-drop listeners are added once, not on every render.
  const importRef = useRef(importer.importFiles);
  importRef.current = importer.importFiles;
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const busyText = useRef(t.importBusy);
  busyText.current = t.importBusy;

  const pickFiles = useCallback(() => fileInput.current?.click(), []);
  const loadSample = useCallback(async () => {
    try {
      if (!(await importer.importFiles(await fetchSampleFiles()))) toast({ text: t.importBusy });
    } catch (err) {
      toast({ text: err instanceof Error ? err.message : String(err), tone: "error" });
    }
  }, [importer, toast, t]);

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
      void importRef.current(Array.from(e.dataTransfer?.files ?? [])).then((started) => {
        if (!started) toastRef.current({ text: busyText.current });
      });
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
  }, []);

  const selected = selectedId ? data.byId.get(selectedId) : undefined;
  const empty = data.all !== null && data.all.length === 0;

  const commands: PaletteCommand[] = useMemo(
    () => [
      {
        id: "import",
        label: t.cmdImport,
        group: t.groupLibrary,
        keywords: ["upload", "open", "zip", "json"],
        onSelect: pickFiles,
      },
      {
        id: "sample",
        label: t.cmdSample,
        group: t.groupLibrary,
        keywords: ["demo", "example"],
        onSelect: () => void loadSample(),
      },
      {
        id: "search",
        label: t.cmdSearch,
        group: t.groupLibrary,
        shortcut: "/",
        keywords: ["find"],
        onSelect: () => {
          setFilters((f) => ({ ...f, view: "active" }));
          setTimeout(() => searchInput.current?.focus(), 0);
        },
      },
      {
        id: "banished",
        label: filters.view === "banished" ? t.cmdBack : t.cmdShowBanished,
        group: t.groupLibrary,
        keywords: ["hidden", "deleted", "trash", "restore"],
        onSelect: () =>
          setFilters((f) => ({
            ...EMPTY_FILTERS,
            view: f.view === "banished" ? "active" : "banished",
          })),
      },
      ...Object.values(prompts).map((p) => ({
        id: `ask-${p}`,
        label: p,
        group: t.groupAsk,
        disabled: agent.busy || empty,
        onSelect: () => void agent.run(p),
      })),
      {
        id: "new",
        label: t.cmdNew,
        group: t.groupAgent,
        keywords: ["reset", "clear"],
        onSelect: agent.reset,
      },
      ...providerCommands,
      {
        id: "settings",
        label: t.cmdSettings,
        group: t.groupApp,
        keywords: ["provider", "api key", "model", "export", "delete"],
        onSelect: () => setSettingsOpen(true),
      },
    ],
    [pickFiles, loadSample, filters.view, agent, empty, t, prompts, providerCommands],
  );

  return (
    <>
      <div className="relative isolate flex h-screen flex-col overflow-clip bg-bg text-fg">
        <a
          href="#seance-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-raised focus:px-3 focus:py-2"
        >
          {kit.skipToContent}
        </a>
        <header className="flex h-12 shrink-0 items-center gap-3 border-b border-line bg-bg px-3">
          <a
            href="/"
            aria-label={kit.home}
            className="grid size-8 place-items-center rounded-md transition-colors duration-100 hover:bg-raised"
          >
            <BrandMark />
          </a>
          <h1 className="text-sm font-semibold text-fg">{t.appTitle}</h1>
          <div className="ml-auto flex items-center gap-1.5">
            <DemoBadge onClick={() => setSettingsOpen(true)} />
            <CommandTrigger onOpen={() => setPaletteOpen(true)} />
            <IconButton aria-label={t.settings} onClick={() => setSettingsOpen(true)}>
              <Settings />
            </IconButton>
          </div>
        </header>

        <ResizablePaneLayout
          left={
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
          center={
            empty ? (
              <div className="flex h-full flex-col items-center justify-center">
                <ArchiveEmpty
                  onSample={() => void loadSample()}
                  onPick={pickFiles}
                  loading={importer.busy}
                />
                <p className="-mt-8 text-xs text-muted">
                  {t.tryDrop}{" "}
                  <a
                    className="text-accent underline underline-offset-4"
                    href={sampleUrl("chatgpt-conversations.json")}
                    download
                  >
                    {t.downloadSample}
                  </a>
                  {t.period}
                </p>
              </div>
            ) : (
              <Reader
                conversation={selected}
                version={data.version}
                onChanged={data.refresh}
                empty={<EmptyState title={t.pickTitle}>{t.pickText}</EmptyState>}
              />
            )
          }
          right={
            <AgentPane
              agent={agent}
              isMock={isMock}
              byId={data.byId}
              hasData={!empty && data.all !== null}
              onManageProviders={() => setSettingsOpen(true)}
            />
          }
          defaultLeftWidth={leftWidth ?? 280}
          defaultRightWidth={rightWidth ?? 320}
          leftMinWidth={200}
          leftMaxWidth={400}
          rightMinWidth={200}
          rightMaxWidth={500}
          labels={{
            left: kit.library,
            center: kit.content,
            right: kit.agent,
          }}
        />
      </div>

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
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-bg/85 backdrop-blur-[2px]">
          <div className="rounded-2xl border-2 border-dashed border-accent/70 px-12 py-10 text-center">
            <p className="text-lg font-semibold text-accent">{t.dropTitle}</p>
            <p className="mt-1 text-sm text-muted">{t.dropText}</p>
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
