import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { colorTokenNames, type ColorTokenName } from "../src/index";

const css = readFileSync(resolve(import.meta.dirname, "../src/tokens.css"), "utf8");

function readTokens(): Record<ColorTokenName, string> {
  const out = {} as Record<ColorTokenName, string>;
  for (const name of colorTokenNames) {
    const m = css.match(new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`));
    if (!m?.[1]) throw new Error(`token --color-${name} missing from tokens.css`);
    out[name] = m[1];
  }
  return out;
}

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const [r, g, b] = channels as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

describe("design tokens", () => {
  const t = readTokens();
  const backgrounds: ColorTokenName[] = ["bg", "surface", "raised", "surface-3"];
  const texts: ColorTokenName[] = ["fg", "fg-2", "muted", "accent", "warn", "danger", "success"];
  for (const bg of backgrounds) {
    for (const fg of texts) {
      it(`${fg} on ${bg} meets WCAG AA (4.5:1)`, () => {
        expect(contrast(t[fg], t[bg])).toBeGreaterThanOrEqual(4.5);
      });
    }
    it(`form field borders on ${bg} meet 3:1 (WCAG 1.4.11)`, () => {
      expect(contrast(t.edge, t[bg])).toBeGreaterThanOrEqual(3);
    });
  }
  it("white text on the solid accent meets WCAG AA", () => {
    expect(contrast("#ffffff", t["accent-solid"])).toBeGreaterThanOrEqual(4.5);
  });
  it("dark text on the danger fill meets WCAG AA", () => {
    expect(contrast(t.bg, t.danger)).toBeGreaterThanOrEqual(4.5);
  });
});
