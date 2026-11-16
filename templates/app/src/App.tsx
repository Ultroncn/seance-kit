import { MockProvider } from "@seance/llm";
import { useAgentRun } from "@seance/react";
import { IndexedDbStorage, type StoredItem } from "@seance/storage";
import {
  AgentPanel,
  AppShell,
  Button,
  CommandPalette,
  DemoBadge,
  EmptyState,
  Kbd,
  PaneHeader,
  ProviderModeProvider,
  SeanceProvider,
  SettingsDialog,
  ToastProvider,
  usePaletteHotkey,
  useProviderMode,
} from "@seance/ui";
import { useCallback, useEffect, useState } from "react";
import { DEMO_PROMPTS, scripts } from "./demo/scripts";
import {
  NOTES,
  SYSTEM_PROMPT,
  TOOL_LABELS,
  createNotesSearch,
  createRegistry,
  type Note,
} from "./tools";

// Step 4: wire it up. Each app on the shared origin needs its own database name.
const storage = new IndexedDbStorage({ name: "my-agent-app" });
const search = createNotesSearch(storage);
const registry = createRegistry({ search });
const mock = new MockProvider({ scripts });
const ready = search.load();

function Workspace() {
  const { provider, isMock } = useProviderMode();
  const [notes, setNotes] = useState<Note[]>([]);
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion((v) => v + 1), []);
  const agent = useAgentRun({
    provider,
    registry,
    storage,
    system: SYSTEM_PROMPT,
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
            <Button variant="ghost" size="sm" onClick={() => setPaletteOpen(true)}>
              Commands <Kbd>⌘K</Kbd>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSettingsOpen(true)}>
              Settings
            </Button>
          </>
        }
        library={
          <>
            <PaneHeader title="Notes" />
            <ul className="p-2" aria-label="Notes">
              {notes.map((n) => (
                <li key={n.id} className="rounded-md px-3 py-2 text-sm">
                  {n.title}
                </li>
              ))}
            </ul>
          </>
        }
        content={
          <EmptyState title="Your app goes here">
            Replace this pane with your own view of the data.
          </EmptyState>
        }
        agent={
          <AgentPanel
            entries={agent.entries}
            busy={agent.busy}
            undone={agent.undone}
            onRun={(p) => void agent.run(p)}
            onApprove={agent.approve}
            onReject={agent.reject}
            onUndo={(t) => void agent.undo(t)}
            onStop={agent.stop}
            onReset={agent.reset}
            suggestions={Object.values(DEMO_PROMPTS)}
            isMock={isMock}
            hasData
            toolLabels={TOOL_LABELS}
            emptyTitle="Ask your notebook"
            emptyText="The agent can search, add and hide notes. It asks before changing anything."
            promptLabel="Ask your notebook"
            placeholder="Ask about your notes…"
          />
        }
      />
      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        commands={[
          {
            id: "settings",
            label: "Open settings",
            group: "App",
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
