import { formatDate } from "@seance/ui";

/** Dates in the reader's language. */
export const shortDate = (iso: string) => formatDate(iso, "day");

export const monthYear = (iso: string) => formatDate(iso, "month");
