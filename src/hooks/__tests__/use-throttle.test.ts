// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useThrottle } from "@/hooks/use-throttle";

describe("useThrottle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-01T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns value immediately on first render", () => {
    const { result } = renderHook(({ value, interval }) => useThrottle(value, interval), {
      initialProps: { value: "start", interval: 1000 },
    });

    expect(result.current).toBe("start");
  });

  it("ignores updates within the interval window", () => {
    const { result, rerender } = renderHook(
      ({ value, interval }) => useThrottle(value, interval),
      {
        initialProps: { value: "first", interval: 1000 },
      },
    );

    vi.setSystemTime(new Date("2026-04-01T00:00:00.500Z"));

    act(() => {
      rerender({ value: "second", interval: 1000 });
    });

    expect(result.current).toBe("first");
  });

  it("accepts updates after the interval elapses", () => {
    const { result, rerender } = renderHook(
      ({ value, interval }) => useThrottle(value, interval),
      {
        initialProps: { value: "first", interval: 1000 },
      },
    );

    vi.setSystemTime(new Date("2026-04-01T00:00:01.100Z"));

    act(() => {
      rerender({ value: "second", interval: 1000 });
    });

    expect(result.current).toBe("second");
  });

  it("works with object payload", () => {
    const { result, rerender } = renderHook(
      ({ value, interval }) => useThrottle<{ count: number }>(value, interval),
      {
        initialProps: { value: { count: 1 }, interval: 1000 },
      },
    );

    expect(result.current).toEqual({ count: 1 });

    vi.setSystemTime(new Date("2026-04-01T00:00:01.100Z"));

    act(() => {
      rerender({ value: { count: 2 }, interval: 1000 });
    });

    expect(result.current).toEqual({ count: 2 });
  });
});
