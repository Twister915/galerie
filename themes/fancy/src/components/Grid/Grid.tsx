// Masonry grid with progressive loading

import { useEffect, useRef, useCallback } from 'preact/hooks';
import { useGalleryStore, useFilteredPhotos } from '../../store/galleryStore';
import { useIntersectionObserver } from '../../hooks/useIntersectionObserver';
import { PhotoTile } from './PhotoTile';
import { GRID_BATCH_SIZE } from '../../config';
import { simpleHash } from '../../utils/hash';
import type { MasonryInstance, Photo } from '../../types';

// Compute a deterministic order for photos based on hash
function computeGridOrder(photos: Photo[]): number[] {
  return photos
    .map((photo, index) => ({ index, sortKey: simpleHash(photo.hash) }))
    .sort((a, b) => a.sortKey - b.sortKey)
    .map((item) => item.index);
}

export function Grid() {
  const photos = useFilteredPhotos();
  const gridLoadedCount = useGalleryStore((s) => s.gridLoadedCount);
  const gridLoading = useGalleryStore((s) => s.gridLoading);
  const loadMoreGrid = useGalleryStore((s) => s.loadMoreGrid);
  const setGridLoading = useGalleryStore((s) => s.setGridLoading);
  const openViewer = useGalleryStore((s) => s.openViewer);

  const gridRef = useRef<HTMLDivElement>(null);
  const masonryRef = useRef<MasonryInstance | null>(null);
  const gridOrderRef = useRef<number[]>([]);
  const prevLoadedCountRef = useRef(0);

  // Compute grid order when photos change
  useEffect(() => {
    gridOrderRef.current = computeGridOrder(photos);
    prevLoadedCountRef.current = 0;

    // Reset masonry when photos change
    if (masonryRef.current && gridRef.current) {
      // Clear grid and reload
      loadMoreGrid(GRID_BATCH_SIZE);
    }
  }, [photos, loadMoreGrid]);

  // Initialize Masonry
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

    // Trigger initial load
    loadMoreGrid(GRID_BATCH_SIZE);

    return () => {
      masonryRef.current = null;
    };
  }, [loadMoreGrid]);

  // Handle layout after new tiles are added
  useEffect(() => {
    if (gridLoadedCount > prevLoadedCountRef.current && masonryRef.current && gridRef.current) {
      const newTiles = gridRef.current.querySelectorAll(
        '.photo-tile:not(.masonry-appended)'
      ) as NodeListOf<HTMLElement>;

      if (newTiles.length > 0) {
        const tilesArray = Array.from(newTiles);
        tilesArray.forEach((tile) => tile.classList.add('masonry-appended'));

        masonryRef.current.appended(tilesArray);

        if (window.imagesLoaded) {
          window.imagesLoaded(tilesArray, () => {
            masonryRef.current?.layout();
          });
        } else {
          requestAnimationFrame(() => {
            masonryRef.current?.layout();
          });
        }
      }

      prevLoadedCountRef.current = gridLoadedCount;
    }
  }, [gridLoadedCount]);

  // Load more handler for infinite scroll
  const handleLoadMore = useCallback(() => {
    if (gridLoading) return;
    if (gridLoadedCount >= gridOrderRef.current.length) return;

    setGridLoading(true);
    loadMoreGrid(GRID_BATCH_SIZE);
    setGridLoading(false);
  }, [gridLoading, gridLoadedCount, loadMoreGrid, setGridLoading]);

  // Infinite scroll sentinel
  const sentinelRef = useIntersectionObserver(handleLoadMore, {
    rootMargin: '200px',
    enabled: gridLoadedCount < gridOrderRef.current.length,
  });

  // Handle tile click
  const handleTileClick = useCallback(
    (index: number) => {
      openViewer(index);
    },
    [openViewer]
  );

  // Get photos to render based on grid order
  const visibleIndices = gridOrderRef.current.slice(0, gridLoadedCount);

  return (
    <main class="gallery" id="gallery">
      <div ref={gridRef} class="masonry-grid" id="masonry-grid">
        <div class="grid-sizer" />
        <div class="gutter-sizer" />
        {visibleIndices.map((photoIndex) => {
          const photo = photos[photoIndex];
          if (!photo) return null;
          return (
            <PhotoTile
              key={photo.stem}
              photo={photo}
              index={photoIndex}
              onClick={handleTileClick}
            />
          );
        })}
      </div>
      <div
        ref={sentinelRef}
        class="loading-sentinel"
        style={{ height: '1px', width: '100%', clear: 'both' }}
      />
    </main>
  );
}
