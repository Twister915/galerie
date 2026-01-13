// Intersection observer hook for infinite scroll

import { useEffect, useRef, type RefObject } from 'preact/hooks';

interface UseIntersectionObserverOptions {
  rootMargin?: string;
  threshold?: number | number[];
  enabled?: boolean;
}

export function useIntersectionObserver(
  callback: () => void,
  options: UseIntersectionObserverOptions = {}
): RefObject<HTMLDivElement> {
  const { rootMargin = '200px', threshold = 0, enabled = true } = options;
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

  return sentinelRef;
}
