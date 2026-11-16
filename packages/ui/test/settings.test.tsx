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
        <SettingsDialog
          open={open}
          onOpenChange={setOpen}
          download={download}
          exportName="test"
          loadModels={async () => [{ id: "model-b" }, { id: "model-a", reasoning: true }]}
        />
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

/** Add a provider through the editor and make it the active one. */
async function addProvider(vendor: string, key: string, model: string) {
  await userEvent.click(screen.getByRole("button", { name: "Add a provider" }));
  await userEvent.selectOptions(screen.getByLabelText("Vendor"), vendor);
  if (key) await userEvent.type(screen.getByLabelText(/^API key/), key);
  const m = screen.getByLabelText("Model");
  await userEvent.clear(m);
  if (model) await userEvent.type(m, model);
  await userEvent.click(screen.getByRole("button", { name: "Save and use" }));
}
const seed = (storage: MemoryStorage, ...names: string[]) =>
  storage.put("secrets", {
    id: "providers",
    activeId: names.length ? "p1" : null,
    profiles: names.map((name, i) => ({
      id: `p${i + 1}`,
      name,
      preset: "anthropic",
      config: { kind: "anthropic", apiKey: `sk-secret-${i + 1}`, model: "m" },
    })),
  });

describe("Demo-mode badge and settings", () => {
  it("shows the badge in demo mode, and it opens settings", async () => {
    render(<App storage={new MemoryStorage()} />);
    expect(badge()).not.toBeNull();
    expect(screen.getByTestId("provider").textContent).toBe("mock:true");
    await userEvent.click(badge()!);
    expect(screen.getByRole("dialog", { name: "Settings" })).toBeTruthy();
  });

  it("adding a provider hides the badge and switches the agent's provider, and it persists", async () => {
    const storage = new MemoryStorage();
    const { unmount } = render(<App storage={storage} />);
    await userEvent.click(badge()!);
    await userEvent.click(screen.getByRole("button", { name: "Add a provider" }));
    await userEvent.selectOptions(screen.getByLabelText("Vendor"), "anthropic");
    expect(screen.getByLabelText("API key").getAttribute("type")).toBe("password");
    expect(screen.getByRole("link", { name: /Get an API key/ }).getAttribute("rel")).toContain(
      "noopener",
    );
    await userEvent.type(screen.getByLabelText("API key"), "sk-test");
    await userEvent.type(screen.getByLabelText("Model"), "some-model");
    await userEvent.click(screen.getByRole("button", { name: "Save and use" }));
    await waitFor(() => expect(badge()).toBeNull());
    expect(screen.getByTestId("provider").textContent).toBe("anthropic:false");
    expect(screen.getByRole("status").textContent).toBe("Now using Anthropic (Claude).");
    unmount();
    render(<App storage={storage} />);
    await waitFor(() => expect(screen.getByTestId("provider").textContent).toBe("anthropic:false"));
    expect(badge()).toBeNull();
  });

  it("switches between demo and saved providers without losing them, like CC Switch", async () => {
    const storage = new MemoryStorage();
    render(<App storage={storage} />);
    await userEvent.click(badge()!);
    await addProvider("deepseek", "sk-ds", "deepseek-v4-pro");
    await addProvider("anthropic", "sk-ant", "m");
    await waitFor(() => expect(screen.getByTestId("provider").textContent).toBe("anthropic:false"));
    await userEvent.click(screen.getByRole("radio", { name: /Demo \(scripted\)/ }));
    await waitFor(() => expect(badge()).not.toBeNull());
    expect(screen.getByRole("status").textContent).toBe(
      "Demo mode on. Your saved providers are kept.",
    );
    await userEvent.click(screen.getByRole("radio", { name: /DeepSeek/ }));
    await waitFor(() =>
      expect(screen.getByTestId("provider").textContent).toBe("openai-compatible:false"),
    );
    const saved = (await storage.get("secrets", "providers")) as unknown as { profiles: unknown[] };
    expect(saved.profiles).toHaveLength(2);
  });

  it("refuses to save incomplete settings and says why", async () => {
    render(<App storage={new MemoryStorage()} />);
    await userEvent.click(badge()!);
    await addProvider("anthropic", "", "m");
    expect(screen.getByRole("status").textContent).toBe("Enter your API key.");
    expect(badge()).not.toBeNull();
  });

  it("tests the connection without saving, and reports failures without the key", async () => {
    render(<App storage={new MemoryStorage()} />);
    await userEvent.click(badge()!);
    await userEvent.click(screen.getByRole("button", { name: "Add a provider" }));
    await userEvent.selectOptions(screen.getByLabelText("Vendor"), "anthropic");
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

  it("loads the vendor's model list into the Model field's suggestions", async () => {
    render(<App storage={new MemoryStorage()} />);
    await userEvent.click(badge()!);
    await userEvent.click(screen.getByRole("button", { name: "Add a provider" }));
    await userEvent.selectOptions(screen.getByLabelText("Vendor"), "siliconflow");
    await userEvent.click(screen.getByRole("button", { name: "Load model list" }));
    expect(screen.getByRole("status").textContent).toBe("Enter your API key.");
    await userEvent.type(screen.getByLabelText("API key"), "sk-x");
    await userEvent.click(screen.getByRole("button", { name: "Load model list" }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toMatch(/^2 models found/));
    // Every loaded model is listed, whatever is typed: no filtering by the current value.
    const select = screen.getByLabelText("Model") as HTMLSelectElement;
    expect([...select.options].map((o) => o.textContent)).toEqual([
      "Choose a model",
      "model-b",
      "model-a",
      "Other (type the name)",
    ]);
    expect(select.value).toBe("");
    await userEvent.selectOptions(select, "model-a");
    await userEvent.click(screen.getByRole("button", { name: "Save and use" }));
    await waitFor(() => expect(badge()).toBeNull());
    await userEvent.click(screen.getByRole("button", { name: /^Edit / }));
    expect((screen.getByLabelText("Model") as HTMLSelectElement).value).toBe("model-a");
  });

  it("exports data without the key, migrates an old saved key, and wipes only after confirming", async () => {
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
    expect(await storage.list("secrets")).toEqual([]);
    await waitFor(() => expect(badge()).not.toBeNull());
  });

  it("a new vendor never inherits the previous vendor's key, and deleting forgets the key", async () => {
    const storage = new MemoryStorage();
    await seed(storage, "Work");
    render(
      <SeanceProvider>
        <ProviderModeProvider storage={storage} mock={mock} createReal={fakeReal}>
          <DemoBadge />
          <SettingsDialog open onOpenChange={() => {}} />
        </ProviderModeProvider>
      </SeanceProvider>,
    );
    await userEvent.click(await screen.findByRole("button", { name: "Edit Work" }));
    expect((screen.getByLabelText("API key") as HTMLInputElement).value).toBe("sk-secret-1");
    await userEvent.selectOptions(screen.getByLabelText("Vendor"), "openai");
    expect((screen.getByLabelText("API key") as HTMLInputElement).value).toBe("");
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete Work" }));
    await waitFor(() => expect(badge()).not.toBeNull());
    expect(screen.getByRole("status").textContent).toBe("Deleted Work and its key.");
    expect(JSON.stringify(await storage.list("secrets"))).not.toContain("sk-secret-1");
  });

  it("refuses plain-http base URLs except for local servers", async () => {
    render(<App storage={new MemoryStorage()} />);
    await userEvent.click(badge()!);
    await userEvent.click(screen.getByRole("button", { name: "Add a provider" }));
    await userEvent.selectOptions(screen.getByLabelText("Vendor"), "custom-openai");
    const url = screen.getByLabelText("Base URL");
    await userEvent.clear(url);
    await userEvent.type(url, "http://llm.example.com/v1");
    await userEvent.type(screen.getByLabelText("API key"), "sk-x");
    await userEvent.type(screen.getByLabelText("Model"), "m");
    await userEvent.click(screen.getByRole("button", { name: "Save and use" }));
    expect(screen.getByRole("status").textContent).toMatch(/https/);
    expect(badge()).not.toBeNull();
    await userEvent.clear(url);
    await userEvent.type(url, "http://localhost:1234/v1");
    await userEvent.click(screen.getByRole("button", { name: "Save and use" }));
    await waitFor(() => expect(badge()).toBeNull());
  });

  it("keeps saved names unique, so the model picker and the palette can tell them apart", async () => {
    render(<App storage={new MemoryStorage()} />);
    await userEvent.click(badge()!);
    await addProvider("deepseek", "sk-1", "deepseek-v4-pro");
    await userEvent.click(screen.getByRole("button", { name: "Add a provider" }));
    await userEvent.selectOptions(screen.getByLabelText("Vendor"), "deepseek");
    expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe("DeepSeek 2");
    await userEvent.clear(screen.getByLabelText("Name"));
    await userEvent.type(screen.getByLabelText("Name"), "DeepSeek");
    await userEvent.type(screen.getByLabelText("API key"), "sk-2");
    expect((screen.getByLabelText("Model") as HTMLInputElement).value).toBe("");
    await userEvent.type(screen.getByLabelText("Model"), "deepseek-v4-flash");
    await userEvent.click(screen.getByRole("button", { name: "Save and use" }));
    await waitFor(() => expect(screen.getByRole("radio", { name: /DeepSeek 2/ })).toBeTruthy());
  });

  it("moves focus to Cancel when asking to confirm a wipe, and back when cancelled", async () => {
    render(
      <SeanceProvider>
        <ProviderModeProvider storage={new MemoryStorage()} mock={mock} createReal={fakeReal}>
          <SettingsDialog open onOpenChange={() => {}} />
        </ProviderModeProvider>
      </SeanceProvider>,
    );
    const trigger = screen.getByRole("button", { name: "Delete all local data…" });
    await userEvent.click(trigger);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Cancel" }));
    await userEvent.keyboard("{Enter}");
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Delete all local data…" }),
    );
  });
});
