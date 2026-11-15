// Shared setup for jsdom component tests. Node-environment tests skip all of this.
import { afterEach } from "vitest";

if (typeof window !== "undefined") {
  const { cleanup } = await import("@testing-library/react");
  afterEach(() => cleanup());

  // jsdom lacks these. cmdk and Radix call them.
  window.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  Element.prototype.scrollIntoView ??= function scrollIntoView() {};
  window.matchMedia ??= (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}
