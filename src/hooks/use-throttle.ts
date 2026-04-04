"use client";

import { useRef, useState } from "react";

export function useThrottle<T>(value: T, interval: number): T {
  const [throttled, setThrottled] = useState<T>(value);
  const lastUpdated = useRef<number>(0);
  const now = Date.now();

  if (lastUpdated.current === 0) {
    lastUpdated.current = now;
    return throttled;
  }

  if (now - lastUpdated.current >= interval && !Object.is(throttled, value)) {
    // Intentional render-time state update:
    // useThrottle checks the timestamp on every render
    // and updates state synchronously when the interval
    // has elapsed. This is deliberate — no useEffect or
    // setInterval needed for ref-based throttling.
    lastUpdated.current = now;
    setThrottled(value);
  }

  return throttled;
}
