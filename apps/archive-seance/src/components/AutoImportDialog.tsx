import * as Dialog from "@radix-ui/react-dialog";
import { Button, IconButton, kitMessages, useT } from "@seance/ui";
import { FolderOpen, Info, LoaderCircle, X } from "lucide-react";
import { useState } from "react";
import {
  DETECTABLE_SOURCES,
  getSuggestedPaths,
  pickAndScanDirectory,
  type DetectableSource,
  type ScanError,
} from "../importers/auto-detect";
import { archiveMessages } from "../messages";

interface Props {
  open: boolean;
  onClose: () => void;
  onFilesSelected: (files: File[]) => void;
}

/** Pick a tool, then the folder holding its data; matching files go through the normal importer. */
export function AutoImportDialog({ open, onClose, onFilesSelected }: Props) {
  const t = useT(archiveMessages).autoImport;
  const kit = useT(kitMessages);
  const [selected, setSelected] = useState<DetectableSource | null>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<ScanError | null>(null);

  const pick = async (source: DetectableSource) => {
    setSelected(source);
    setError(null);
    setScanning(true);
    try {
      const result = await pickAndScanDirectory(source);
      if (result.error) return setError(result.error);
      if (result.files.length === 0) return; // The picker was cancelled.
      onFilesSelected(result.files);
      onClose();
    } catch {
      setError("failed");
    } finally {
      setScanning(false);
    }
  };

  const label = DETECTABLE_SOURCES.find((s) => s.source === selected)?.label ?? "";
  const message =
    error === "no-picker"
      ? t.noPicker
      : error === "none-found"
        ? t.noneFound(label)
        : error
          ? t.failed
          : null;
  const paths = selected && error === "none-found" ? getSuggestedPaths(selected) : [];

  return (
    <Dialog.Root open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[85vh] w-[min(35rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl border border-line bg-surface shadow-dialog">
          <div className="flex items-start gap-3 px-6 pb-4 pt-5">
            <div className="min-w-0 flex-1">
              <Dialog.Title className="text-xl font-semibold">{t.title}</Dialog.Title>
              <Dialog.Description className="mt-1 text-meta text-muted">
                {t.intro}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <IconButton aria-label={kit.cancel} size="sm" tooltip={false} className="-mr-2">
                <X />
              </IconButton>
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 pb-6">
            <ul className="space-y-2">
              {DETECTABLE_SOURCES.map((s) => (
                <li key={s.source}>
                  <button
                    type="button"
                    onClick={() => void pick(s.source)}
                    disabled={scanning}
                    className="flex w-full items-center gap-3 rounded-lg border border-line px-3 py-2.5 text-left transition-colors duration-100 hover:bg-raised disabled:text-disabled disabled:hover:bg-transparent"
                  >
                    <FolderOpen aria-hidden className="size-4 shrink-0 text-muted" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-fg">{s.label}</span>
                      <span className="block text-xs text-muted">{t.pick(s.label)}</span>
                    </span>
                    {selected === s.source && scanning && (
                      <LoaderCircle
                        aria-hidden
                        className="size-4 shrink-0 animate-spin text-accent motion-reduce:animate-none"
                      />
                    )}
                  </button>
                </li>
              ))}
            </ul>
            {message && (
              <div
                role="alert"
                className="rounded-lg border border-line bg-danger-soft p-3 text-sm text-fg"
              >
                <p>{message}</p>
                {paths.length > 0 && (
                  <>
                    <p className="mt-2 text-xs font-medium text-fg-2">{t.whereToLook}</p>
                    <ul className="mt-1 space-y-0.5 font-mono text-xs text-muted">
                      {paths.map((path) => (
                        <li key={path}>{path}</li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )}
            <div className="flex gap-3 rounded-lg bg-raised p-3 text-meta text-muted">
              <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
              <div className="space-y-1.5">
                <p>
                  <span className="font-medium text-fg-2">{t.whyTitle} </span>
                  {t.why}
                </p>
                <p>
                  <span className="font-medium text-fg-2">{t.privacyTitle} </span>
                  {t.privacy}
                </p>
              </div>
            </div>
          </div>
          <div className="flex justify-end border-t border-line px-6 py-3">
            <Button variant="ghost" onClick={onClose} disabled={scanning}>
              {kit.cancel}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
