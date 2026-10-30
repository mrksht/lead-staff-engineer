import { useEffect, useRef, useState, useCallback } from "react";

/**
 * Measures render time from mount to paint.
 * Uses Performance API for accurate timing.
 */
export function useRenderMetrics(_label: string) {
  const mountTime = useRef(performance.now());
  const [metrics, setMetrics] = useState({
    renderTime: 0,
    domNodes: 0,
    heapUsed: 0,
  });

  useEffect(() => {
    // requestAnimationFrame fires after React commits to DOM
    // The second rAF fires after the browser actually paints
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const paintTime = performance.now();
        const domNodes = document.querySelectorAll("*").length;
        const heapUsed =
          (performance as unknown as { memory?: { usedJSHeapSize: number } })
            .memory?.usedJSHeapSize ?? 0;

        setMetrics({
          renderTime: Math.round(paintTime - mountTime.current),
          domNodes,
          heapUsed: Math.round(heapUsed / 1024 / 1024),
        });
      });
    });
  }, []);

  return metrics;
}

/**
 * Measures FPS during scroll interactions.
 */
export function useFPSCounter() {
  const [fps, setFps] = useState(60);
  const frameTimesRef = useRef<number[]>([]);
  const rafIdRef = useRef<number>(0);
  const isRunningRef = useRef(false);

  const start = useCallback(() => {
    if (isRunningRef.current) return;
    isRunningRef.current = true;
    frameTimesRef.current = [];

    const tick = () => {
      frameTimesRef.current.push(performance.now());
      // Keep last 60 frame timestamps
      if (frameTimesRef.current.length > 60) {
        frameTimesRef.current.shift();
      }

      const times = frameTimesRef.current;
      if (times.length >= 2) {
        const elapsed = times[times.length - 1] - times[0];
        const currentFps = Math.round(((times.length - 1) / elapsed) * 1000);
        setFps(Math.min(currentFps, 120));
      }

      if (isRunningRef.current) {
        rafIdRef.current = requestAnimationFrame(tick);
      }
    };

    rafIdRef.current = requestAnimationFrame(tick);
  }, []);

  const stop = useCallback(() => {
    isRunningRef.current = false;
    cancelAnimationFrame(rafIdRef.current);
  }, []);

  useEffect(() => {
    return () => {
      isRunningRef.current = false;
      cancelAnimationFrame(rafIdRef.current);
    };
  }, []);

  return { fps, start, stop };
}
