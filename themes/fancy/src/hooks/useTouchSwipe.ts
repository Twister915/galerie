// Touch swipe detection hook

import { useRef, useCallback } from 'preact/hooks';
import { SWIPE_THRESHOLD, SWIPE_TIME_LIMIT } from '../config';

interface TouchState {
  startX: number;
  startY: number;
  startTime: number;
}

interface SwipeHandlers {
  onTouchStart: (e: TouchEvent) => void;
  onTouchMove: (e: TouchEvent) => void;
  onTouchEnd: (e: TouchEvent) => void;
}

export function useTouchSwipe(
  onSwipeLeft: () => void,
  onSwipeRight: () => void,
  onTap?: () => void
): SwipeHandlers {
  const touchState = useRef<TouchState>({
    startX: 0,
    startY: 0,
    startTime: 0,
  });

  const onTouchStart = useCallback((e: TouchEvent) => {
    if ((e.target as HTMLElement).closest('#filmstrip')) return;
    touchState.current = {
      startX: e.touches[0].clientX,
      startY: e.touches[0].clientY,
      startTime: Date.now(),
    };
  }, []);

  const onTouchMove = useCallback((e: TouchEvent) => {
    if ((e.target as HTMLElement).closest('#filmstrip')) return;
    const { startX, startY } = touchState.current;
    const deltaX = e.touches[0].clientX - startX;
    const deltaY = e.touches[0].clientY - startY;

    // Prevent vertical scrolling when swiping horizontally
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 10) {
      e.preventDefault();
    }
  }, []);

  const onTouchEnd = useCallback(
    (e: TouchEvent) => {
      if ((e.target as HTMLElement).closest('#filmstrip')) return;
      const { startX, startY, startTime } = touchState.current;
      const deltaX = e.changedTouches[0].clientX - startX;
      const deltaY = e.changedTouches[0].clientY - startY;
      const deltaTime = Date.now() - startTime;

      if (
        deltaTime < SWIPE_TIME_LIMIT &&
        Math.abs(deltaX) > SWIPE_THRESHOLD &&
        Math.abs(deltaX) > Math.abs(deltaY)
      ) {
        if (deltaX > 0) {
          onSwipeRight();
        } else {
          onSwipeLeft();
        }
      } else if (onTap && Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10) {
        onTap();
      }
    },
    [onSwipeLeft, onSwipeRight, onTap]
  );

  return { onTouchStart, onTouchMove, onTouchEnd };
}
