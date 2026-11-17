import { lazy, Suspense, useEffect, useState } from "react";
import type { CommandPaletteProps } from "./CommandPalette";

const Palette = lazy(() =>
  import("./CommandPalette").then((module) => ({ default: module.CommandPalette })),
);

/** Keep the hotkey eager, but load the palette UI on its first opening. */
export function CommandPalette(props: CommandPaletteProps) {
  const [opened, setOpened] = useState(props.open);
  useEffect(() => {
    if (props.open) setOpened(true);
  }, [props.open]);
  return opened || props.open ? (
    <Suspense fallback={null}>
      <Palette {...props} />
    </Suspense>
  ) : null;
}
