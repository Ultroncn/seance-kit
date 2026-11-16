import { MockProvider } from "@seance/llm";
import { useAgentRun } from "@seance/react";
import { Settings } from "lucide-react";
import { IndexedDbStorage, type StoredItem } from "@seance/storage";
import {
  AgentPanel,
  AppShell,
  CommandPalette,
  CommandTrigger,
  DemoBadge,
  EmptyState,
  IconButton,
  PaneHeader,
  ProviderModeProvider,
  SeanceProvider,
  SettingsDialog,
  ToastProvider,
  tNow,
  usePaletteHotkey,
  useProviderCommands,
  useProviderMode,
  useT,
  withReplyLanguage,
} from "@seance/ui";
import { useCallback, useEffect, useState } from "react";
import { scripts } from "./demo/scripts";
import { demoMessages, messages } from "./messages";
import { NOTES, SYSTEM_PROMPT, createNotesSearch, createRegistry, type Note } from "./tools";

// Step 4: wire it up. Each app on the shared origin needs its own database name.
const storage = new IndexedDbStorage({ name: "my-agent-app" });
const search = createNotesSearch(storage);
const registry = createRegistry({ search });
const mock = new MockProvider({
  scripts,
  typingMs: 14,
  unknownPromptText: () => tNow(demoMessages).unknown,
});
const ready = search.load();

function Workspace() {
  const { provider, isMock } = useProviderMode();
  const providerCommands = useProviderCommands();
  const t = useT(messages);
  const prompts = useT(demoMessages).prompts;
  const [notes, setNotes] = useState<Note[]>([]);
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion((v) => v + 1), []);
  const agent = useAgentRun({
    provider,
    registry,
    storage,
    system: withReplyLanguage(SYSTEM_PROMPT),
    onDataChange: refresh,
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  usePaletteHotkey(setPaletteOpen);

  useEffect(() => {
    void ready
      .then(() => storage.list<Note>(NOTES))
      .then((all) => setNotes(all.filter((n: StoredItem) => !n.banishedAt)));
  }, [version]);

  return (
    <>
      <AppShell
        title="My Agent App"
        actions={
          <>
            <DemoBadge onClick={() => setSettingsOpen(true)} />
            <CommandTrigger onOpen={() => setPaletteOpen(true)} />
            <IconButton aria-label={t.settings} onClick={() => setSettingsOpen(true)}>
              <Settings />
            </IconButton>
          </>
        }
        library={
          <>
            <PaneHeader title={t.notes} />
            <ul className="p-2" aria-label={t.notes}>
              {notes.map((n) => (
                <li key={n.id} className="rounded-md px-3 py-2 text-sm">
                  {n.title}
                </li>
              ))}
            </ul>
          </>
        }
        content={<EmptyState title={t.contentTitle}>{t.contentText}</EmptyState>}
        agent={
          <AgentPanel
            entries={agent.entries}
            busy={agent.busy}
            undone={agent.undone}
            onRun={(p) => void agent.run(p)}
            onApprove={agent.approve}
            onReject={agent.reject}
            onUndo={(token) => void agent.undo(token)}
            onStop={agent.stop}
            onReset={agent.reset}
            suggestions={Object.values(prompts)}
            isMock={isMock}
            hasData
            onManageProviders={() => setSettingsOpen(true)}
            toolLabels={t.toolLabels}
            emptyTitle={t.emptyTitle}
            emptyText={t.emptyText}
            promptLabel={t.promptLabel}
            placeholder={t.placeholder}
          />
        }
      />
      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        commands={[
          ...providerCommands,
          {
            id: "settings",
            label: t.openSettings,
            group: t.groupApp,
            keywords: ["provider", "api key"],
            onSelect: () => setSettingsOpen(true),
          },
        ]}
      />
      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        exportName="my-agent-app"
        onAfterWipe={refresh}
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
