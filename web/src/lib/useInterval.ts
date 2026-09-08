import { useEffect, useRef } from "react";

/**
 * Runs `callback` on a fixed interval (ms). Pass `null` to pause.
 * The latest callback is always used without restarting the timer.
 */
export function useInterval(callback: () => void, delay: number | null) {
  const saved = useRef(callback);

  useEffect(() => {
    saved.current = callback;
  }, [callback]);

  useEffect(() => {
    if (delay === null) return;
    const id = setInterval(() => saved.current(), delay);
    return () => clearInterval(id);
  }, [delay]);
}