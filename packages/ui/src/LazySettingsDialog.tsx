import { lazy, Suspense, useEffect, useState } from "react";
import type { SettingsDialogProps } from "./SettingsDialog";

const Dialog = lazy(() =>
  import("./SettingsDialog").then((module) => ({ default: module.SettingsDialog })),
);

/** Defer the editor until first opened; keep it mounted afterwards for Radix focus restoration. */
export function SettingsDialog(props: SettingsDialogProps) {
  const [opened, setOpened] = useState(props.open);
  useEffect(() => {
    if (props.open) setOpened(true);
  }, [props.open]);
  return opened || props.open ? (
    <Suspense fallback={null}>
      <Dialog {...props} />
    </Suspense>
  ) : null;
}
