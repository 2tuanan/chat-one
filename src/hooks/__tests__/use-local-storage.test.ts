// @vitest-environment jsdom

import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useLocalStorage } from "@/hooks/use-local-storage";

describe("useLocalStorage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("returns initialValue when storage is empty", () => {
    const { result } = renderHook(() => useLocalStorage("demo", "default"));

    expect(result.current[0]).toBe("default");
  });

  it("reads and parses stored JSON on mount", () => {
    localStorage.setItem("demo", JSON.stringify("stored"));

    const { result } = renderHook(() => useLocalStorage("demo", "default"));

    expect(result.current[0]).toBe("stored");
  });

  it("writes to localStorage and updates state atomically", () => {
    const { result } = renderHook(() => useLocalStorage("demo", "default"));

    act(() => {
      result.current[1]("next");
    });

    expect(result.current[0]).toBe("next");
    expect(localStorage.getItem("demo")).toBe("\"next\"");
  });

  it("falls back to initialValue when stored JSON is invalid", () => {
    localStorage.setItem("demo", "{invalid-json");

    const { result } = renderHook(() => useLocalStorage("demo", "default"));

    expect(result.current[0]).toBe("default");
  });

  it("returns initialValue when window is unavailable", () => {
    const originalWindow = globalThis.window;

    Object.defineProperty(globalThis, "window", {
      value: undefined,
      configurable: true,
    });

    try {
      const Component = () => {
        const [value] = useLocalStorage("demo", "default");
        return createElement("span", null, value);
      };

      const html = renderToString(createElement(Component));

      expect(html).toContain("default");
    } finally {
      Object.defineProperty(globalThis, "window", {
        value: originalWindow,
        configurable: true,
      });
    }
  });

  it("works with array payload", () => {
    const { result } = renderHook(() =>
      useLocalStorage<string[]>("list", []),
    );

    act(() => {
      result.current[1](["alpha", "bravo"]);
    });

    expect(result.current[0]).toEqual(["alpha", "bravo"]);
    expect(localStorage.getItem("list")).toBe("[\"alpha\",\"bravo\"]");
  });
});
