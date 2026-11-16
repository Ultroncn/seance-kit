import { Badge, useT, type BadgeTone } from "@seance/ui";
import type { Category } from "../domain/types";
import { inboxMessages } from "../messages";

const TONE: Record<Category, BadgeTone> = {
  "needs-reply": "candle",
  personal: "ecto",
  receipt: "neutral",
  notification: "neutral",
  newsletter: "neutral",
  noise: "blood",
};

export function CategoryBadge({ category, small }: { category: Category; small?: boolean }) {
  const t = useT(inboxMessages);
  return (
    <Badge tone={TONE[category]} className={small ? "px-1.5 py-0 text-[10px]" : undefined}>
      {t.category[category]}
    </Badge>
  );
}
