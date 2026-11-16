import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { CONTENT_MIN, PANE_DEFAULTS, PANE_LIMITS, clampWidths, readWidths } from "../src/index";

const anyNumber = fc.oneof(
  fc.double(),
  fc.integer({ min: -5000, max: 5000 }),
  fc.constant(Number.NaN),
);
const widths = fc.record({ library: anyNumber, agent: anyNumber });
const minTotal = PANE_LIMITS.library.min + PANE_LIMITS.agent.min + CONTENT_MIN;

describe("pane widths", () => {
  it("P15 side panes stay within their limits, leave the content pane room, and clamping twice changes nothing", () => {
    fc.assert(
      fc.property(widths, fc.integer({ min: 0, max: 4000 }), (w, screen) => {
        const out = clampWidths(w, screen);
        expect(out.library).toBeGreaterThanOrEqual(PANE_LIMITS.library.min);
        expect(out.library).toBeLessThanOrEqual(PANE_LIMITS.library.max);
        expect(out.agent).toBeGreaterThanOrEqual(PANE_LIMITS.agent.min);
        expect(out.agent).toBeLessThanOrEqual(PANE_LIMITS.agent.max);
        if (screen >= minTotal)
          expect(out.library + out.agent + CONTENT_MIN).toBeLessThanOrEqual(screen);
        expect(clampWidths(out, screen)).toEqual(out);
      }),
    );
  });

  it("P15 saved widths are read back, and anything damaged falls back to the defaults", () => {
    fc.assert(
      fc.property(fc.string(), (raw) => {
        const out = readWidths(raw);
        expect(typeof out.library).toBe("number");
        expect(typeof out.agent).toBe("number");
      }),
    );
    expect(readWidths(JSON.stringify({ library: 300, agent: 450 }))).toEqual({
      library: 300,
      agent: 450,
    });
    expect(readWidths(JSON.stringify({ left: 300, right: 450 }))).toEqual(PANE_DEFAULTS);
    expect(readWidths(null)).toEqual(PANE_DEFAULTS);
  });
});
