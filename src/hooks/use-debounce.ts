"use client";

import { useEffect, useRef, useState } from "react";

/** Default debounce for text inputs: long enough to skip mid-word keystrokes, short enough to feel live. */
export const INPUT_DEBOUNCE_MS = 300;

/**
 * Returns `value`, but only after it has stopped changing for `delayMs`.
 * Use it to keep an expensive derived computation (filtering thousands of rows,
 * a request) from running on every keystroke while the input itself stays live.
 */
export function useDebouncedValue<T>(value: T, delayMs: number = INPUT_DEBOUNCE_MS): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

type Debounced<A extends unknown[]> = {
  /** Schedule a call; any call already waiting is replaced. */
  run: (...args: A) => void;
  /** Drop the waiting call, if any. */
  cancel: () => void;
};

/**
 * A stable debounced wrapper around `callback`.
 *
 * The timer id and the latest callback live in refs: they are mutable values
 * that must survive renders but must never cause one. The returned object is
 * created once, so it is safe to pass to memoised children.
 */
export function useDebouncedCallback<A extends unknown[]>(callback: (...args: A) => void, delayMs: number = INPUT_DEBOUNCE_MS): Debounced<A> {
  const timerRef = useRef<number | undefined>(undefined);
  const callbackRef = useRef(callback);
  const delayRef = useRef(delayMs);

  // Keep the latest callback/delay without re-creating the debounced function.
  useEffect(() => {
    callbackRef.current = callback;
    delayRef.current = delayMs;
  });

  // Never fire after unmount.
  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  const [debounced] = useState<Debounced<A>>(() => ({
    run: (...args: A) => {
      window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        timerRef.current = undefined;
        callbackRef.current(...args);
      }, delayRef.current);
    },
    cancel: () => {
      window.clearTimeout(timerRef.current);
      timerRef.current = undefined;
    },
  }));

  return debounced;
}
