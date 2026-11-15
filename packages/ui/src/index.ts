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
