import { formatDate } from "@seance/ui";

/** "14:30" for today-ish lists is not useful for an archive; show a compact date instead. */
export const listDate = (iso: string) => formatDate(iso, "day");

export const fullDate = (iso: string) => formatDate(iso, "full");

export const megabytes = (bytes: number) =>
  `${(bytes / 1_048_576).toFixed(bytes < 10_485_760 ? 1 : 0)} MB`;
