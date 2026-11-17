import { lazy, Suspense } from "react";
import { useInView } from "./useInView";

const Timeline = lazy(() =>
  import("./TimelineDemo").then((module) => ({ default: module.TimelineDemo })),
);

/** Load the existing below-the-fold demo just before it enters the viewport. */
export function TimelineDemo() {
  const [ref, seen] = useInView<HTMLDivElement>("240px");
  return (
    <div ref={ref} className="min-h-[23rem]">
      {seen && (
        <Suspense fallback={null}>
          <Timeline />
        </Suspense>
      )}
    </div>
  );
}
