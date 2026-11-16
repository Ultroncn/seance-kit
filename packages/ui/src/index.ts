/** Color token names defined in tokens.css (`--color-<name>`). */
export const colorTokenNames = [
  "bg",
  "surface",
  "raised",
  "surface-3",
  "line",
  "edge",
  "fg",
  "fg-2",
  "muted",
  "accent",
  "accent-solid",
  "warn",
  "danger",
  "success",
] as const;

export type ColorTokenName = (typeof colorTokenNames)[number];

export { cn } from "./cn";
export { formatDuration, formatJson } from "./format";
export { SeanceProvider } from "./Provider";
export {
  Badge,
  Button,
  IconButton,
  Input,
  Kbd,
  Select,
  TextArea,
  Tooltip,
  fieldClass,
  type BadgeTone,
  type ButtonProps,
  type ButtonSize,
  type ButtonVariant,
  type ControlSize,
  type IconButtonProps,
  type InputProps,
  type SelectProps,
} from "./primitives";
export { AppShell, EmptyState, PaneHeader, type AppShellProps } from "./AppShell";
export {
  CommandPalette,
  isPaletteHotkey,
  paletteScore,
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
export {
  ProviderModeProvider,
  useProviderMode,
  type ProviderModeProviderProps,
  type ProviderModeValue,
} from "./ProviderMode";
export { DemoBadge } from "./DemoBadge";
export { SettingsDialog, isAllowedEndpoint, type SettingsDialogProps } from "./SettingsDialog";
export { useProviderCommands } from "./providerCommands";
export { ModelPicker, withModelChoice } from "./ModelPicker";
export { BrandMark } from "./BrandMark";
export { CommandTrigger } from "./CommandTrigger";
export { Segmented, type SegmentedItem } from "./Segmented";
export { GhostItem, GhostList } from "./GhostList";
export { ToastProvider, useToast, type ToastInput } from "./Toast";
export { AgentPanel, type AgentPanelProps } from "./AgentPanel";
export {
  LOCALES,
  defineMessages,
  formatDate,
  getLocale,
  plural,
  setLocale,
  tNow,
  useLocale,
  useT,
  withReplyLanguage,
  type Locale,
  type Messages,
} from "./i18n";
export { kitMessages } from "./messages";
export { LanguageSwitch } from "./LanguageSwitch";
