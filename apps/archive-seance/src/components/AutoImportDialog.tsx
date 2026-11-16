import { Button, useT } from "@seance/ui";
import * as Dialog from "@radix-ui/react-dialog";
import { FolderOpen, Info, X } from "lucide-react";
import { useState } from "react";
import {
  DETECTABLE_SOURCES,
  getSuggestedPaths,
  pickAndScanDirectory,
  type DetectableSource,
} from "../importers/auto-detect";
import { archiveMessages } from "../messages";

interface Props {
  open: boolean;
  onClose: () => void;
  onFilesSelected: (files: File[]) => void;
}

export function AutoImportDialog({ open, onClose, onFilesSelected }: Props) {
  const t = useT(archiveMessages);
  const [selectedSource, setSelectedSource] = useState<DetectableSource | null>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePickSource = async (source: DetectableSource) => {
    setSelectedSource(source);
    setError(null);
    setScanning(true);

    try {
      const result = await pickAndScanDirectory(source);

      if (result.error) {
        setError(result.error);
        setScanning(false);
        return;
      }

      if (result.files.length === 0) {
        setScanning(false);
        return; // User cancelled
      }

      // Pass files to parent for import
      onFilesSelected(result.files);
      setScanning(false);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "导入失败");
      setScanning(false);
    }
  };

  const suggestedPaths = selectedSource && error ? getSuggestedPaths(selectedSource) : [];

  return (
    <Dialog.Root open={open} onOpenChange={(isOpen: boolean) => !isOpen && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[85vh] w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border border-line bg-raised p-6 shadow-xl">
          <div className="mb-4 flex items-start justify-between">
            <Dialog.Title className="text-lg font-semibold text-fg">
              一键导入会话
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                className="rounded-md p-1 text-muted transition-colors hover:bg-surface-mid hover:text-fg"
                aria-label="关闭"
              >
                <X className="h-5 w-5" />
              </button>
            </Dialog.Close>
          </div>

          <div className="space-y-4">
            <p className="text-sm text-muted">
              选择一个 AI 工具，自动检测并导入其本地会话数据。
            </p>

            <div className="grid gap-3">
              {DETECTABLE_SOURCES.map((source) => (
                <button
                  key={source.source}
                  onClick={() => handlePickSource(source.source)}
                  disabled={scanning}
                  className="flex items-start gap-3 rounded-lg border border-line bg-surface p-4 text-left transition-colors hover:border-accent hover:bg-surface-mid disabled:opacity-50"
                >
                  <FolderOpen className="mt-0.5 h-5 w-5 flex-shrink-0 text-accent" />
                  <div className="flex-1 space-y-1">
                    <div className="font-medium text-fg">{source.label}</div>
                    <div className="text-sm text-muted">{source.description}</div>
                  </div>
                  {selectedSource === source.source && scanning && (
                    <div className="flex-shrink-0">
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                    </div>
                  )}
                </button>
              ))}
            </div>

            {error && (
              <div className="rounded-lg border border-danger/30 bg-danger/10 p-4">
                <div className="flex items-start gap-3">
                  <Info className="mt-0.5 h-5 w-5 flex-shrink-0 text-danger" />
                  <div className="flex-1 space-y-2">
                    <div className="text-sm text-fg">{error}</div>
                    {suggestedPaths.length > 0 && (
                      <div className="space-y-1">
                        <div className="text-xs font-medium text-fg-2">建议查找路径：</div>
                        <ul className="space-y-1 text-xs text-muted">
                          {suggestedPaths.map((path) => (
                            <li key={path} className="font-mono">
                              {path}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="rounded-lg border border-line bg-surface p-4">
              <div className="flex items-start gap-3">
                <Info className="mt-0.5 h-5 w-5 flex-shrink-0 text-accent" />
                <div className="flex-1 space-y-2 text-sm text-muted">
                  <p>
                    <strong className="text-fg">浏览器限制：</strong>
                    由于安全原因，浏览器无法自动扫描文件系统。点击上方选项后，
                    系统会提示你选择对应工具的数据目录。
                  </p>
                  <p>
                    <strong className="text-fg">隐私保护：</strong>
                    所有数据仅在你的浏览器本地处理，不会上传到任何服务器。
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 flex justify-end gap-2 border-t border-line pt-4">
            <Button variant="ghost" onClick={onClose} disabled={scanning}>
              取消
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
