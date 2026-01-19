// Intersection observer hook for infinite scroll

import { useEffect, useRef, type RefObject } from 'preact/hooks';

interface UseIntersectionObserverOptions {
  rootMargin?: string;
  threshold?: number | number[];
  enabled?: boolean;
  resetKey?: string | number;
}

export function useIntersectionObserver(
  callback: () => void,
  options: UseIntersectionObserverOptions = {}
): RefObject<HTMLDivElement> {
  const { rootMargin = '200px', threshold = 0, enabled = true, resetKey } = options;
  const sentinelRef = useRef<HTMLDivElement>(null);
  const callbackRef = useRef(callback);

  // Keep callback ref updated
  callbackRef.current = callback;

  useEffect(() => {
    if (!enabled) return;

    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          callbackRef.current();
        }
      },
      { rootMargin, threshold }
    );

    observer.observe(sentinel);

    return () => observer.disconnect();
  }, [rootMargin, threshold, enabled]);

  // Handle edge case: if sentinel is visible on initial load and stays visible
  // after loading a batch, the IntersectionObserver won't fire again (no state
  // change). Periodically check if sentinel is still visible and keep loading.
  useEffect(() => {
    if (!enabled) return;

    let rafId: number;
    let timeoutId: number;

    const checkSentinelVisibility = () => {
      const sentinel = sentinelRef.current;
      if (!sentinel) return;

      const rect = sentinel.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const rootMarginPx = parseInt(rootMargin, 10) || 0;
      const isVisible = rect.top < viewportHeight + rootMarginPx;

      if (isVisible) {
        callbackRef.current();
        // Check again after a delay to allow layout to settle
        timeoutId = window.setTimeout(() => {
          rafId = requestAnimationFrame(checkSentinelVisibility);
        }, 50);
      }
    };

    // Initial check after a short delay for layout to settle
    timeoutId = window.setTimeout(() => {
      rafId = requestAnimationFrame(checkSentinelVisibility);
    }, 100);

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(timeoutId);
    };
  }, [enabled, rootMargin, resetKey]);

  return sentinelRef;
}
