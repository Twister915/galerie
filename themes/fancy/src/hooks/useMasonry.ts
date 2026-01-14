// Masonry.js integration hook

import { useRef, useEffect, useCallback, type RefObject } from 'preact/hooks';
import type { MasonryInstance } from '../types';

interface UseMasonryResult {
  gridRef: RefObject<HTMLDivElement>;
  layout: () => void;
  appended: (elements: HTMLElement[]) => void;
}

export function useMasonry(): UseMasonryResult {
  const gridRef = useRef<HTMLDivElement>(null);
  const masonryRef = useRef<MasonryInstance | null>(null);

  // Initialize Masonry on mount
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid || !window.Masonry) return;

    masonryRef.current = new window.Masonry(grid, {
      itemSelector: '.photo-tile',
      columnWidth: '.grid-sizer',
      gutter: '.gutter-sizer',
      fitWidth: true,
      transitionDuration: 0,
      initLayout: false,
    });

    // Initial layout
    requestAnimationFrame(() => {
      masonryRef.current?.layout();
    });

    return () => {
      masonryRef.current = null;
    };
  }, []);

  const layout = useCallback(() => {
    masonryRef.current?.layout();
  }, []);

  const appended = useCallback((elements: HTMLElement[]) => {
    if (!masonryRef.current || elements.length === 0) return;

    masonryRef.current.appended(elements);

    // Wait for images to load, then relayout
    if (window.imagesLoaded) {
      window.imagesLoaded(elements, () => {
        masonryRef.current?.layout();
      });
    } else {
      // Fallback without imagesLoaded
      requestAnimationFrame(() => {
        masonryRef.current?.layout();
      });
    }
  }, []);

  return { gridRef, layout, appended };
}
