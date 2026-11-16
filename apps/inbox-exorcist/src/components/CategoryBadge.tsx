import { Badge, useT, type BadgeTone } from "@seance/ui";
import type { Category } from "../domain/types";
import { inboxMessages } from "../messages";

const TONE: Record<Category, BadgeTone> = {
  "needs-reply": "warn",
  personal: "accent",
  receipt: "neutral",
  notification: "neutral",
  newsletter: "neutral",
  noise: "danger",
};

export function CategoryBadge({ category, small }: { category: Category; small?: boolean }) {
  const t = useT(inboxMessages);
  return (
    <Badge tone={TONE[category]} className={small ? "px-1.5 py-0 text-xs" : undefined}>
      {t.category[category]}
    </Badge>
  );
}
