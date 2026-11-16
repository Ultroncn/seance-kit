/**
 * Auto-detect and import conversations from locally installed AI tools.
 * Browser-safe: uses File System Access API when available.
 */

export type DetectableSource = "claude-code" | "chatgpt" | "gemini" | "deepseek" | "cursor";

export interface SourceLocation {
  source: DetectableSource;
  label: string;
  /** Known paths where this tool stores conversations (platform-specific). */
  paths: {
    mac?: string[];
    windows?: string[];
    linux?: string[];
  };
  /** File patterns to look for. */
  patterns: string[];
  /** Description for the UI. */
  description: string;
}

export const DETECTABLE_SOURCES: SourceLocation[] = [
  {
    source: "claude-code",
    label: "Claude Code",
    paths: {
      mac: [
        "~/Library/Application Support/Claude/",
        "~/.claude/",
      ],
      windows: [
        "%APPDATA%/Claude/",
        "%USERPROFILE%/.claude/",
      ],
      linux: [
        "~/.config/claude/",
        "~/.claude/",
      ],
    },
    patterns: ["conversations.json", "*/conversations.json"],
    description: "从 Claude Code 本地会话数据导入",
  },
  {
    source: "chatgpt",
    label: "ChatGPT",
    paths: {
      mac: [
        "~/Downloads/",
      ],
      windows: [
        "%USERPROFILE%/Downloads/",
      ],
      linux: [
        "~/Downloads/",
      ],
    },
    patterns: ["conversations.json", "chatgpt-export-*.zip"],
    description: "从 ChatGPT 导出文件导入（通常在下载文件夹）",
  },
  {
    source: "gemini",
    label: "Gemini",
    paths: {
      mac: [
        "~/Downloads/",
      ],
      windows: [
        "%USERPROFILE%/Downloads/",
      ],
      linux: [
        "~/Downloads/",
      ],
    },
    patterns: ["gemini-export-*.json", "*.json"],
    description: "从 Gemini 导出文件导入",
  },
  {
    source: "deepseek",
    label: "DeepSeek",
    paths: {
      mac: [
        "~/Downloads/",
      ],
      windows: [
        "%USERPROFILE%/Downloads/",
      ],
      linux: [
        "~/Downloads/",
      ],
    },
    patterns: ["deepseek-*.json", "*.json"],
    description: "从 DeepSeek 导出文件导入",
  },
  {
    source: "cursor",
    label: "Cursor",
    paths: {
      mac: [
        "~/Library/Application Support/Cursor/",
      ],
      windows: [
        "%APPDATA%/Cursor/",
      ],
      linux: [
        "~/.config/Cursor/",
      ],
    },
    patterns: ["conversations.json", "*/conversations.json"],
    description: "从 Cursor IDE 会话数据导入",
  },
];

export interface DetectedFile {
  source: DetectableSource;
  label: string;
  path: string;
  /** For display only, without full system path. */
  displayPath: string;
}

/**
 * Browser environment: we can't actually scan the file system.
 * This function guides the user to pick the right directory.
 */
export function getSourceInstructions(source: DetectableSource): SourceLocation | undefined {
  return DETECTABLE_SOURCES.find((s) => s.source === source);
}

/**
 * Use File System Access API to let the user pick a directory and find conversations.
 * Returns files that match the source's patterns.
 */
export async function pickAndScanDirectory(
  source: DetectableSource,
): Promise<{ files: File[]; error?: string }> {
  const sourceInfo = DETECTABLE_SOURCES.find((s) => s.source === source);
  if (!sourceInfo) {
    return { files: [], error: "Unknown source" };
  }

  // Check if File System Access API is available
  if (!("showDirectoryPicker" in window)) {
    return {
      files: [],
      error: "Your browser doesn't support directory access. Please drag and drop files instead.",
    };
  }

  try {
    // @ts-ignore - File System Access API not in all TypeScript versions
    const dirHandle: FileSystemDirectoryHandle = await window.showDirectoryPicker({
      mode: "read",
      startIn: "downloads",
    });

    const files: File[] = [];
    const seen = new Set<string>();

    // Recursively scan the directory
    async function scan(handle: FileSystemDirectoryHandle, depth = 0): Promise<void> {
      // Limit recursion depth to avoid infinite loops
      if (depth > 3) return;

      // @ts-ignore - FileSystemDirectoryHandle.values() exists in modern browsers
      for await (const entry of handle.values()) {
        if (entry.kind === "file") {
          // @ts-ignore - FileSystemFileHandle.getFile() exists
          const file: File = await entry.getFile();
          // Check if file matches any pattern
          const matches = sourceInfo!.patterns.some((pattern) => {
            if (pattern.includes("*")) {
              const regex = new RegExp("^" + pattern.replace(/\*/g, ".*") + "$");
              return regex.test(file.name);
            }
            return file.name === pattern;
          });

          if (matches && !seen.has(file.name)) {
            files.push(file);
            seen.add(file.name);
          }
        } else if (entry.kind === "directory" && !entry.name.startsWith(".")) {
          await scan(entry as FileSystemDirectoryHandle, depth + 1);
        }
      }
    }

    await scan(dirHandle);

    if (files.length === 0) {
      return {
        files: [],
        error: `No ${sourceInfo.label} conversation files found in the selected directory.`,
      };
    }

    return { files };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return { files: [] }; // User cancelled
    }
    return {
      files: [],
      error: err instanceof Error ? err.message : "Failed to access directory",
    };
  }
}

/**
 * Get the current platform for showing relevant paths to the user.
 */
export function getCurrentPlatform(): "mac" | "windows" | "linux" {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("mac")) return "mac";
  if (ua.includes("win")) return "windows";
  return "linux";
}

/**
 * Get suggested paths for a source on the current platform.
 */
export function getSuggestedPaths(source: DetectableSource): string[] {
  const sourceInfo = DETECTABLE_SOURCES.find((s) => s.source === source);
  if (!sourceInfo) return [];

  const platform = getCurrentPlatform();
  return sourceInfo.paths[platform] ?? [];
}
