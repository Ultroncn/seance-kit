import * as RadixTooltip from "@radix-ui/react-tooltip";
import {
  forwardRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";
import { cn } from "./cn";

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
export type ButtonSize = "sm" | "md";

const variantClass: Record<ButtonVariant, string> = {
  primary: "bg-ecto text-bg hover:brightness-110",
  secondary: "border border-line bg-raised text-fg hover:border-muted",
  danger: "bg-blood text-bg hover:brightness-110",
  ghost: "text-muted hover:bg-raised hover:text-fg",
};

const sizeClass: Record<ButtonSize, string> = {
  sm: "h-8 gap-1.5 px-3 text-sm",
  md: "h-10 gap-2 px-4 text-sm",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", className, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-md font-medium transition-[filter,background-color,border-color,color] duration-150",
        "disabled:pointer-events-none disabled:opacity-50",
        variantClass[variant],
        sizeClass[size],
        className,
      )}
      {...rest}
    />
  );
});

const fieldClass =
  "w-full rounded-md border border-line bg-surface px-3 text-sm text-fg placeholder:text-muted transition-colors duration-150 hover:border-muted focus-visible:border-ecto";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return <input ref={ref} className={cn(fieldClass, "h-10", className)} {...rest} />;
  },
);

export const TextArea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function TextArea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={cn(fieldClass, "min-h-20 py-2", className)} {...rest} />;
});

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded border border-line bg-raised px-1.5 py-0.5 font-mono text-[11px] text-muted">
      {children}
    </kbd>
  );
}

export type BadgeTone = "neutral" | "ecto" | "candle" | "blood";

const toneClass: Record<BadgeTone, string> = {
  neutral: "border-line text-muted",
  ecto: "border-ecto/40 text-ecto",
  candle: "border-candle/40 text-candle",
  blood: "border-blood/40 text-blood",
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
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
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
          className="z-50 max-w-64 rounded-md border border-line bg-raised px-2.5 py-1.5 text-xs text-fg shadow-lg"
        >
          {content}
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  );
}
