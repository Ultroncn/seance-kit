import * as RadixTooltip from "@radix-ui/react-tooltip";
import { ChevronDown } from "lucide-react";
import {
  forwardRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { cn } from "./cn";

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost" | "danger-ghost";
export type ControlSize = "sm" | "md" | "lg";
/** @deprecated Use ControlSize. */
export type ButtonSize = ControlSize;

/*
 * Controls share one height scale: sm 28, md 32 (the app default), lg 40. Disabled controls get a
 * flat fill and dim text instead of fading, so they never look broken.
 */
const variantClass: Record<ButtonVariant, string> = {
  primary:
    "bg-accent-solid text-on-accent hover:bg-accent-hover active:bg-accent-active disabled:bg-surface-3 disabled:text-disabled",
  secondary:
    "border border-line bg-raised text-fg hover:bg-surface-3 disabled:bg-surface disabled:text-disabled",
  danger: "bg-danger text-bg hover:brightness-110 disabled:bg-surface-3 disabled:text-disabled",
  ghost:
    "text-fg-2 hover:bg-raised hover:text-fg disabled:text-disabled disabled:hover:bg-transparent",
  "danger-ghost": "text-danger hover:bg-danger-soft disabled:text-disabled",
};
const sizeClass: Record<ControlSize, string> = {
  sm: "h-7 gap-1.5 px-2.5 text-meta [&_svg]:size-4",
  md: "h-8 gap-1.5 px-3 text-sm [&_svg]:size-4",
  lg: "h-10 gap-2 px-4 text-sm [&_svg]:size-[18px]",
};
const control =
  "inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap rounded-md font-medium transition-colors duration-100 disabled:pointer-events-none";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ControlSize;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", className, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(control, variantClass[variant], sizeClass[size], className)}
      {...rest}
    />
  );
});

const squareClass: Record<ControlSize, string> = {
  sm: "size-7 [&_svg]:size-4",
  md: "size-8 [&_svg]:size-4",
  lg: "size-10 [&_svg]:size-[18px]",
};

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required: an icon-only button needs a name for screen readers. Also shown as a tooltip. */
  "aria-label": string;
  variant?: ButtonVariant;
  size?: ControlSize;
  /** Show the label as a tooltip on hover. Default true. Needs `SeanceProvider` above it. */
  tooltip?: boolean;
}

/** A square button holding one icon. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { variant = "ghost", size = "md", className, type = "button", tooltip = true, ...rest },
  ref,
) {
  const button = (
    <button
      ref={ref}
      type={type}
      className={cn(control, variantClass[variant], squareClass[size], "px-0", className)}
      {...rest}
    />
  );
  return tooltip ? <Tooltip content={rest["aria-label"]}>{button}</Tooltip> : button;
});

/*
 * Fields: dark fill, a field border that meets 3:1, and on focus an accent border with a soft halo
 * instead of an outline.
 */
export const fieldClass =
  "w-full rounded-md border border-edge bg-bg px-3 text-sm text-fg placeholder:text-muted transition-[border-color,box-shadow] duration-100 hover:border-muted focus-visible:border-accent focus-visible:shadow-[0_0_0_3px_color-mix(in_oklab,var(--color-accent)_25%,transparent)] disabled:text-disabled";
const fieldHeight: Record<ControlSize, string> = { sm: "h-7 text-meta", md: "h-8", lg: "h-10" };

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  size?: ControlSize;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, size = "md", ...rest },
  ref,
) {
  return <input ref={ref} className={cn(fieldClass, fieldHeight[size], className)} {...rest} />;
});

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "size"> {
  size?: ControlSize;
}

/**
 * A native select drawn like our inputs: no OS chevron, our border, font and focus halo. The list
 * stays native, so keyboard, screen readers and mobile pickers work as people expect.
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, size = "md", children, ...rest },
  ref,
) {
  return (
    <span className={cn("relative inline-flex min-w-0", className)}>
      <select
        ref={ref}
        className={cn(
          fieldClass,
          fieldHeight[size],
          "cursor-pointer appearance-none truncate pr-8",
        )}
        {...rest}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted"
      />
    </span>
  );
});

export const TextArea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function TextArea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={cn(fieldClass, "min-h-20 py-2", className)} {...rest} />;
});

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-sm border border-line bg-raised px-1.5 font-mono text-xs text-muted">
      {children}
    </kbd>
  );
}

export type BadgeTone = "neutral" | "accent" | "warn" | "danger";

/** Neutral badges are outlined; colored ones are a soft fill with same-hue text and no border. */
const toneClass: Record<BadgeTone, string> = {
  neutral: "border border-line text-fg-2",
  accent: "bg-accent-soft text-accent",
  warn: "bg-warn-soft text-warn",
  danger: "bg-danger-soft text-danger",
};

export function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 text-xs font-medium",
        toneClass[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Plain-language explanation for spooky labels. Needs `SeanceProvider` above it. */
export function Tooltip({ content, children }: { content: ReactNode; children: ReactNode }) {
  return (
    <RadixTooltip.Root>
      <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content
          sideOffset={6}
          className="z-50 max-w-60 rounded-md border border-line bg-raised px-2.5 py-1.5 text-xs text-fg shadow-popover"
        >
          {content}
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  );
}
