/** Color token names defined in tokens.css (`--color-<name>`). */
export const colorTokenNames = [
  "bg",
  "surface",
  "raised",
  "line",
  "fg",
  "muted",
  "ecto",
  "candle",
  "blood",
] as const;

export type ColorTokenName = (typeof colorTokenNames)[number];

export { cn } from "./cn";
export { formatDuration, formatJson } from "./format";
export { SeanceProvider } from "./Provider";
export {
  Badge,
  Button,
  Input,
  Kbd,
  TextArea,
  Tooltip,
  type BadgeTone,
  type ButtonProps,
  type ButtonSize,
  type ButtonVariant,
} from "./primitives";
export { AppShell, EmptyState, PaneHeader, type AppShellProps } from "./AppShell";
export {
  CommandPalette,
  isPaletteHotkey,
  usePaletteHotkey,
  type CommandPaletteProps,
  type PaletteCommand,
} from "./CommandPalette";
export { ApprovalCard, type ApprovalCardProps } from "./ApprovalCard";
export {
  SeanceTimeline,
  timelineStatus,
  type ApprovalCopy,
  type SeanceTimelineProps,
} from "./SeanceTimeline";
export type { StepRisk, TimelineEntry, ToolEntry, ToolStepStatus } from "./timeline-types";
