import { MockProvider } from "@seance/llm";
import { IndexedDbStorage } from "@seance/storage";
import {
  AppShell,
  Button,
  CommandPalette,
  DemoBadge,
  EmptyState,
  Kbd,
  PaneHeader,
  ProviderModeProvider,
  SeanceProvider,
  SeanceTimeline,
  SettingsDialog,
  usePaletteHotkey,
} from "@seance/ui";
import { useState } from "react";

// Both apps share one origin, so each needs its own database name.
const storage = new IndexedDbStorage({ name: "archive-seance" });
// Scripts arrive with the agent tools in milestone M2.
const mock = new MockProvider({ scripts: [] });

function Workspace() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  usePaletteHotkey(setPaletteOpen);

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
        library={<PaneHeader title="Library" />}
        content={
          <EmptyState title="No chats yet">
            Import a ChatGPT or Claude export to begin. It stays in this browser.
          </EmptyState>
        }
        agent={
          <>
            <PaneHeader title="Séance" />
            <SeanceTimeline
              entries={[]}
              onApprove={() => {}}
              onReject={() => {}}
              empty={
                <EmptyState title="The agent arrives in milestone M2">
                  Import, search, summarize and resurrect your old AI chats.
                </EmptyState>
              }
            />
          </>
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
            keywords: ["provider", "api key", "model", "export", "delete"],
            onSelect: () => setSettingsOpen(true),
          },
        ]}
      />
      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        exportName="archive-seance"
      />
    </>
  );
}

export function App() {
  return (
    <SeanceProvider>
      <ProviderModeProvider storage={storage} mock={mock}>
        <Workspace />
      </ProviderModeProvider>
    </SeanceProvider>
  );
}
