// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import {
  LanguageSwitch,
  defineMessages,
  formatDate,
  getLocale,
  kitMessages,
  setLocale,
  useT,
  withReplyLanguage,
} from "../src/index";

const m = defineMessages(
  { hi: "Hello", n: (x: number) => `${x} items` },
  { hi: "你好", n: (x: number) => `${x} 项` },
);
function Greeting() {
  const t = useT(m);
  return (
    <p>
      {t.hi} {t.n(2)}
    </p>
  );
}

afterEach(() => act(() => setLocale("en")));

describe("i18n", () => {
  it("switching the language re-renders, sets <html lang> and is remembered", async () => {
    render(
      <>
        <LanguageSwitch />
        <Greeting />
      </>,
    );
    expect(screen.getByText("Hello 2 items")).toBeTruthy();
    expect(screen.getByRole("button", { name: "EN" }).getAttribute("aria-pressed")).toBe("true");
    await userEvent.click(screen.getByRole("button", { name: "中文" }));
    expect(screen.getByText("你好 2 项")).toBeTruthy();
    expect(document.documentElement.lang).toBe("zh-CN");
    expect(localStorage.getItem("seance.locale")).toBe("zh");
    expect(screen.getByRole("group", { name: kitMessages.zh.language })).toBeTruthy();
    expect(getLocale()).toBe("zh");
  });

  it("formats dates in the reader's language, in UTC", () => {
    expect(formatDate("2019-11-03T23:30:00Z", "day", "en")).toBe("Nov 3, 2019");
    expect(formatDate("2019-11-03T23:30:00Z", "month", "zh")).toBe("2019年11月");
    expect(formatDate("not a date", "day", "en")).toBe("not a date");
  });

  it("tells a real model the reply language only in Chinese", () => {
    expect(withReplyLanguage("SYS", "en")).toBe("SYS");
    expect(withReplyLanguage("SYS", "zh")).toMatch(/^SYS\n- .*Simplified Chinese/);
  });
});
