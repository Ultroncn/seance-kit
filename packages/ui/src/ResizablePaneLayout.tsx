import { useEffect, useRef, useState } from "react";
import { cn } from "./cn";

interface ResizablePaneLayoutProps {
  /** Left pane content */
  left: React.ReactNode;
  /** Center pane content */
  center: React.ReactNode;
  /** Right pane content */
  right: React.ReactNode;
  /** Left pane min/max width in pixels */
  leftMinWidth?: number;
  leftMaxWidth?: number;
  /** Right pane min/max width in pixels */
  rightMinWidth?: number;
  rightMaxWidth?: number;
  /** Default left pane width */
  defaultLeftWidth?: number;
  /** Default right pane width */
  defaultRightWidth?: number;
  /** CSS class for left pane */
  leftClassName?: string;
  /** CSS class for center pane */
  centerClassName?: string;
  /** CSS class for right pane */
  rightClassName?: string;
  /** Labels for accessibility */
  labels?: { left?: string; center?: string; right?: string };
}

/**
 * Three-pane layout with draggable dividers to resize left and right panes.
 * Center pane takes remaining space.
 */
export function ResizablePaneLayout({
  left,
  center,
  right,
  leftMinWidth = 200,
  leftMaxWidth = 400,
  rightMinWidth = 200,
  rightMaxWidth = 500,
  defaultLeftWidth = 280,
  defaultRightWidth = 320,
  leftClassName,
  centerClassName,
  rightClassName,
  labels = {},
}: ResizablePaneLayoutProps) {
  const [leftWidth, setLeftWidth] = useState(defaultLeftWidth);
  const [rightWidth, setRightWidth] = useState(defaultRightWidth);
  const containerRef = useRef<HTMLDivElement>(null);
  const leftDividerRef = useRef<HTMLDivElement>(null);
  const rightDividerRef = useRef<HTMLDivElement>(null);
  const [draggingLeft, setDraggingLeft] = useState(false);
  const [draggingRight, setDraggingRight] = useState(false);

  // Handle left divider drag
  useEffect(() => {
    if (!draggingLeft) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const newWidth = e.clientX - rect.left;

      if (newWidth >= leftMinWidth && newWidth <= leftMaxWidth) {
        setLeftWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setDraggingLeft(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [draggingLeft, leftMinWidth, leftMaxWidth]);

  // Handle right divider drag
  useEffect(() => {
    if (!draggingRight) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const newWidth = rect.right - e.clientX;

      if (newWidth >= rightMinWidth && newWidth <= rightMaxWidth) {
        setRightWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setDraggingRight(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [draggingRight, rightMinWidth, rightMaxWidth]);

  return (
    <div
      ref={containerRef}
      className="flex h-full w-full overflow-hidden bg-bg"
    >
      {/* Left pane */}
      <nav
        aria-label={labels.left}
        style={{ width: `${leftWidth}px`, minWidth: `${leftMinWidth}px`, maxWidth: `${leftMaxWidth}px` }}
        className={cn("overflow-y-auto border-r border-line bg-surface", leftClassName)}
      >
        {left}
      </nav>

      {/* Left divider */}
      <div
        ref={leftDividerRef}
        onMouseDown={() => setDraggingLeft(true)}
        className={cn(
          "w-1 cursor-col-resize select-none transition-colors duration-150 hover:bg-accent/40",
          draggingLeft && "bg-accent/60",
          !draggingLeft && "bg-line/40"
        )}
        role="separator"
        aria-label="Resize left panel"
      />

      {/* Center pane */}
      <main
        aria-label={labels.center}
        className={cn("flex-1 overflow-y-auto min-w-0", centerClassName)}
      >
        {center}
      </main>

      {/* Right divider */}
      <div
        ref={rightDividerRef}
        onMouseDown={() => setDraggingRight(true)}
        className={cn(
          "w-1 cursor-col-resize select-none transition-colors duration-150 hover:bg-accent/40",
          draggingRight && "bg-accent/60",
          !draggingRight && "bg-line/40"
        )}
        role="separator"
        aria-label="Resize right panel"
      />

      {/* Right pane */}
      <aside
        aria-label={labels.right}
        style={{ width: `${rightWidth}px`, minWidth: `${rightMinWidth}px`, maxWidth: `${rightMaxWidth}px` }}
        className={cn("overflow-y-auto border-l border-line bg-surface", rightClassName)}
      >
        {right}
      </aside>
    </div>
  );
}

/**
 * Hook to persist pane widths to localStorage
 */
export function useResizablePaneWidths(storageKey: string) {
  const [leftWidth, setLeftWidth] = useState<number | null>(null);
  const [rightWidth, setRightWidth] = useState<number | null>(null);

  // Load from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const { left, right } = JSON.parse(stored);
        if (typeof left === "number") setLeftWidth(left);
        if (typeof right === "number") setRightWidth(right);
      }
    } catch {
      // Ignore parse errors
    }
  }, [storageKey]);

  // Save to localStorage when widths change
  const saveWidths = (left: number, right: number) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ left, right }));
    } catch {
      // Ignore storage errors
    }
  };

  return { leftWidth, rightWidth, saveWidths };
}
