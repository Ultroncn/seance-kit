import { Badge, type BadgeTone } from "@seance/ui";
import { CATEGORY_LABEL, type Category } from "../domain/types";

const TONE: Record<Category, BadgeTone> = {
  "needs-reply": "candle",
  personal: "ecto",
  receipt: "neutral",
  notification: "neutral",
  newsletter: "neutral",
  noise: "blood",
};

export function CategoryBadge({ category, small }: { category: Category; small?: boolean }) {
  return (
    <Badge tone={TONE[category]} className={small ? "px-1.5 py-0 text-[10px]" : undefined}>
      {CATEGORY_LABEL[category]}
    </Badge>
  );
}
