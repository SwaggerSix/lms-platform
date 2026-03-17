"use client";

import { useState, useEffect, useCallback } from "react";

export function useCountdown(initialSeconds: number, autoStart = false) {
  const [seconds, setSeconds] = useState(initialSeconds);
  const [isRunning, setIsRunning] = useState(autoStart);

  useEffect(() => {
    if (!isRunning || seconds <= 0) return;
    const interval = setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) {
          setIsRunning(false);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isRunning, seconds]);

  const start = useCallback(() => setIsRunning(true), []);
  const pause = useCallback(() => setIsRunning(false), []);
  const reset = useCallback(
    (newSeconds?: number) => {
      setSeconds(newSeconds ?? initialSeconds);
      setIsRunning(false);
    },
    [initialSeconds]
  );

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  const formatted = `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;

  return { seconds, minutes, remainingSeconds, formatted, isRunning, isExpired: seconds <= 0, start, pause, reset };
}
