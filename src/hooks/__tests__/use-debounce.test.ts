// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDebounce } from "@/hooks/use-debounce";

describe("useDebounce", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("returns initial value synchronously", () => {
    const { result } = renderHook(({ value, delay }) => useDebounce(value, delay), {
      initialProps: { value: "start", delay: 300 },
    });

    expect(result.current).toBe("start");
  });

  it("debounces rapid changes and emits only the final value", () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: "first", delay: 300 },
      },
    );

    rerender({ value: "second", delay: 300 });
    rerender({ value: "third", delay: 300 });

    act(() => {
      vi.advanceTimersByTime(299);
    });

    expect(result.current).toBe("first");

    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(result.current).toBe("third");
  });

  it("clears the timeout on cleanup and avoids updates after unmount", () => {
    const clearSpy = vi.spyOn(globalThis, "clearTimeout");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { rerender, unmount, result } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: "initial", delay: 300 },
      },
    );

    rerender({ value: "next", delay: 300 });

    unmount();

    act(() => {
      vi.runOnlyPendingTimers();
    });

    expect(clearSpy).toHaveBeenCalled();
    expect(result.current).toBe("initial");
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("responds to delay changes", () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: "alpha", delay: 500 },
      },
    );

    rerender({ value: "bravo", delay: 500 });

    act(() => {
      vi.advanceTimersByTime(400);
    });

    expect(result.current).toBe("alpha");

    rerender({ value: "bravo", delay: 100 });

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(result.current).toBe("bravo");
  });

  it("works with number payload", () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce<number>(value, delay),
      {
        initialProps: { value: 0, delay: 100 },
      },
    );

    rerender({ value: 1, delay: 100 });
    rerender({ value: 2, delay: 100 });

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(result.current).toBe(2);
  });
});
