// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MockProvider, type Provider, type ProviderConfig } from "@seance/llm";
import { MemoryStorage } from "@seance/storage";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  DemoBadge,
  ProviderModeProvider,
  SeanceProvider,
  SettingsDialog,
  useProviderMode,
} from "../src/index";

const mock = new MockProvider({ scripts: [] });

/** Fake real provider: no network. Replies "OK", or throws when the key is "bad". */
function fakeReal(config: ProviderConfig): Provider {
  return {
    id: config.kind,
    isMock: false,
    async complete() {
      if ("apiKey" in config && config.apiKey === "bad")
        throw new Error("Provider request failed (HTTP 401)");
      return { text: "OK", toolCalls: [] };
    },
  };
}

function ProviderId() {
  const { provider, isMock } = useProviderMode();
  return <p data-testid="provider">{`${provider.id}:${isMock}`}</p>;
}

function App({
  storage,
  download,
}: {
  storage: MemoryStorage;
  download?: (b: Blob, n: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <SeanceProvider>
      <ProviderModeProvider storage={storage} mock={mock} createReal={fakeReal}>
        <DemoBadge onClick={() => setOpen(true)} />
        <ProviderId />
        <SettingsDialog open={open} onOpenChange={setOpen} download={download} exportName="test" />
      </ProviderModeProvider>
    </SeanceProvider>
  );
}

const badge = () => screen.queryByTestId("demo-badge");

/** jsdom's Blob has no text(). FileReader works. */
const readBlob = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsText(blob);
  });

describe("Demo-mode badge and settings", () => {
  it("shows the badge in demo mode, and it opens settings", async () => {
    render(<App storage={new MemoryStorage()} />);
    expect(badge()).not.toBeNull();
    expect(screen.getByTestId("provider").textContent).toBe("mock:true");
    await userEvent.click(badge()!);
    expect(screen.getByRole("dialog", { name: "Settings" })).toBeTruthy();
  });

  it("saving a real provider hides the badge and switches the agent's provider, and it persists", async () => {
    const storage = new MemoryStorage();
    const { unmount } = render(<App storage={storage} />);
    await userEvent.click(badge()!);
    await userEvent.click(screen.getByRole("radio", { name: "Anthropic" }));
    const key = screen.getByLabelText("API key");
    expect(key.getAttribute("type")).toBe("password");
    await userEvent.type(key, "sk-test");
    await userEvent.type(screen.getByLabelText("Model"), "some-model");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(badge()).toBeNull());
    expect(screen.getByTestId("provider").textContent).toBe("anthropic:false");

    unmount();
    render(<App storage={storage} />);
    await waitFor(() => expect(screen.getByTestId("provider").textContent).toBe("anthropic:false"));
    expect(badge()).toBeNull();
  });

  it("going back to demo removes the key and brings the badge back", async () => {
    const storage = new MemoryStorage();
    await storage.put("secrets", {
      id: "provider",
      kind: "anthropic",
      apiKey: "sk-test",
      model: "m",
    });
    const Opener = () => {
      const [open, setOpen] = useState(true);
      return (
        <SeanceProvider>
          <ProviderModeProvider storage={storage} mock={mock} createReal={fakeReal}>
            <DemoBadge />
            <SettingsDialog open={open} onOpenChange={setOpen} />
          </ProviderModeProvider>
        </SeanceProvider>
      );
    };
    render(<Opener />);
    await waitFor(() =>
      expect((screen.getByRole("radio", { name: "Anthropic" }) as HTMLInputElement).checked).toBe(
        true,
      ),
    );
    await userEvent.click(screen.getByRole("radio", { name: "Demo (scripted)" }));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(badge()).not.toBeNull());
    expect(await storage.get("secrets", "provider")).toBeUndefined();
  });

  it("refuses to save incomplete settings and says why", async () => {
    render(<App storage={new MemoryStorage()} />);
    await userEvent.click(badge()!);
    await userEvent.click(screen.getByRole("radio", { name: "Anthropic" }));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByRole("status").textContent).toBe("Enter your API key.");
    expect(badge()).not.toBeNull();
  });

  it("tests the connection without saving, and reports failures without the key", async () => {
    render(<App storage={new MemoryStorage()} />);
    await userEvent.click(badge()!);
    await userEvent.click(screen.getByRole("radio", { name: "Anthropic" }));
    await userEvent.type(screen.getByLabelText("API key"), "sk-good");
    await userEvent.type(screen.getByLabelText("Model"), "m");
    await userEvent.click(screen.getByRole("button", { name: "Test connection" }));
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toBe("Connected. The model replied: OK"),
    );
    expect(badge()).not.toBeNull();

    await userEvent.clear(screen.getByLabelText("API key"));
    await userEvent.type(screen.getByLabelText("API key"), "bad");
    await userEvent.click(screen.getByRole("button", { name: "Test connection" }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("HTTP 401"));
    expect(screen.getByRole("status").textContent).not.toContain("bad");
  });

  it("exports data without the key, and wipes everything only after confirming", async () => {
    const storage = new MemoryStorage();
    await storage.put("secrets", {
      id: "provider",
      kind: "anthropic",
      apiKey: "sk-secret",
      model: "m",
    });
    await storage.put("conversations", { id: "c1", title: "Old chat" });
    const download = vi.fn();
    const onAfterWipe = vi.fn();
    render(
      <SeanceProvider>
        <ProviderModeProvider storage={storage} mock={mock} createReal={fakeReal}>
          <DemoBadge />
          <SettingsDialog
            open
            onOpenChange={() => {}}
            download={download}
            onAfterWipe={onAfterWipe}
            exportName="test"
          />
        </ProviderModeProvider>
      </SeanceProvider>,
    );
    await waitFor(() => expect(screen.getByText("Now: real model")).toBeTruthy());

    await userEvent.click(screen.getByRole("button", { name: "Export all data" }));
    await waitFor(() => expect(download).toHaveBeenCalledOnce());
    const [blob, filename] = download.mock.calls[0] as [Blob, string];
    expect(filename).toMatch(/^test-export-\d{4}-\d{2}-\d{2}\.json$/);
    const text = await readBlob(blob);
    expect(text).toContain("Old chat");
    expect(text).not.toContain("sk-secret");

    await userEvent.click(screen.getByRole("button", { name: "Delete all local data…" }));
    expect(screen.getByRole("alert").textContent).toContain("permanently deletes");
    expect(await storage.get("conversations", "c1")).toBeDefined();
    await userEvent.click(screen.getByRole("button", { name: "Delete everything" }));

    await waitFor(() => expect(onAfterWipe).toHaveBeenCalledOnce());
    expect(await storage.list("conversations")).toEqual([]);
    expect(await storage.get("secrets", "provider")).toBeUndefined();
    await waitFor(() => expect(badge()).not.toBeNull());
  });
});
