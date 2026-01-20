// Masonry grid with progressive loading

import { useEffect, useRef, useCallback } from 'preact/hooks';
import {
  useGalleryStore,
  useFilteredPhotos,
  type SortMode,
  type SortDirection,
} from '../../store/galleryStore';
import { useIntersectionObserver } from '../../hooks/useIntersectionObserver';
import { PhotoTile } from './PhotoTile';
import { SortControl } from './SortControl';
import { GRID_BATCH_SIZE, debug } from '../../config';
import { simpleHash } from '../../utils/hash';
import type { MasonryInstance, Photo } from '../../types';

// Compute grid order based on sort mode and direction
function computeGridOrder(
  photos: Photo[],
  sortMode: SortMode,
  sortDirection: SortDirection
): number[] {
  const indexed = photos.map((photo, index) => ({ index, photo }));

  switch (sortMode) {
    case 'shuffle':
      // Deterministic shuffle based on photo hash
      return indexed
        .map((item) => ({ ...item, sortKey: simpleHash(item.photo.hash) }))
        .sort((a, b) => a.sortKey - b.sortKey)
        .map((item) => item.index);

    case 'date':
      return indexed
        .sort((a, b) => {
          const dateA = a.photo.metadata.dateTaken || '';
          const dateB = b.photo.metadata.dateTaken || '';
          const cmp = dateA.localeCompare(dateB);
          return sortDirection === 'asc' ? cmp : -cmp;
        })
        .map((item) => item.index);

    case 'rating':
      return indexed
        .sort((a, b) => {
          const ratingA = a.photo.metadata.rating ?? 0;
          const ratingB = b.photo.metadata.rating ?? 0;
          const cmp = ratingA - ratingB;
          return sortDirection === 'asc' ? cmp : -cmp;
        })
        .map((item) => item.index);

    case 'photographer':
      return indexed
        .sort((a, b) => {
          const copyA = a.photo.metadata.copyright || '';
          const copyB = b.photo.metadata.copyright || '';
          const cmp = copyA.localeCompare(copyB);
          return sortDirection === 'asc' ? cmp : -cmp;
        })
        .map((item) => item.index);

    case 'name':
      return indexed
        .sort((a, b) => {
          const cmp = a.photo.stem.localeCompare(b.photo.stem);
          return sortDirection === 'asc' ? cmp : -cmp;
        })
        .map((item) => item.index);

    default:
      return indexed.map((item) => item.index);
  }
}

export function Grid() {
  const photos = useFilteredPhotos();
  const gridLoadedCount = useGalleryStore((s) => s.gridLoadedCount);
  const gridLoading = useGalleryStore((s) => s.gridLoading);
  const loadMoreGrid = useGalleryStore((s) => s.loadMoreGrid);
  const setGridLoading = useGalleryStore((s) => s.setGridLoading);
  const openViewer = useGalleryStore((s) => s.openViewer);
  const sortMode = useGalleryStore((s) => s.sortMode);
  const sortDirection = useGalleryStore((s) => s.sortDirection);

  const gridRef = useRef<HTMLDivElement>(null);
  const masonryRef = useRef<MasonryInstance | null>(null);
  const gridOrderRef = useRef<number[]>([]);
  const prevLoadedCountRef = useRef(0);

  // Compute grid order when photos or sort settings change
  useEffect(() => {
    debug('[Grid:photosEffect] running | photos.length:', photos.length, '| masonryRef:', !!masonryRef.current, '| gridRef:', !!gridRef.current);
    gridOrderRef.current = computeGridOrder(photos, sortMode, sortDirection);
    debug('[Grid:photosEffect] computed gridOrder length:', gridOrderRef.current.length);
    prevLoadedCountRef.current = 0;

    // Reset masonry when photos or sort changes
    if (masonryRef.current && gridRef.current) {
      // Clear existing tiles for re-sort
      const existingTiles = gridRef.current.querySelectorAll('.photo-tile');
      debug('[Grid:photosEffect] clearing', existingTiles.length, 'tiles and calling loadMoreGrid');
      existingTiles.forEach((tile) => tile.remove());
      // Reload grid
      loadMoreGrid(GRID_BATCH_SIZE);
    } else {
      debug('[Grid:photosEffect] SKIPPED loadMoreGrid - masonry or grid not ready');
    }
  }, [photos, sortMode, sortDirection, loadMoreGrid]);

  // Safeguard: ensure grid loads when photos exist but gridLoadedCount is 0
  // This handles race conditions during initial hash-based routing on mobile
  useEffect(() => {
    debug('[Grid:safeguardEffect] running | gridLoadedCount:', gridLoadedCount, '| photos.length:', photos.length, '| masonryRef:', !!masonryRef.current);
    if (gridLoadedCount === 0 && photos.length > 0 && masonryRef.current) {
      debug('[Grid:safeguardEffect] CONDITIONS MET - calling loadMoreGrid');
      loadMoreGrid(GRID_BATCH_SIZE);
    }
  }, [gridLoadedCount, photos.length, loadMoreGrid]);

  // Initialize Masonry
  useEffect(() => {
    debug('[Grid:masonryInit] running | gridRef:', !!gridRef.current, '| window.Masonry:', !!window.Masonry);
    const grid = gridRef.current;
    if (!grid || !window.Masonry) {
      debug('[Grid:masonryInit] ABORTED - grid or Masonry not available');
      return;
    }

    masonryRef.current = new window.Masonry(grid, {
      itemSelector: '.photo-tile',
      columnWidth: '.grid-sizer',
      gutter: '.gutter-sizer',
      fitWidth: true,
      transitionDuration: 0,
      initLayout: false,
    });
    debug('[Grid:masonryInit] Masonry created, calling loadMoreGrid');

    // Initial layout
    requestAnimationFrame(() => {
      masonryRef.current?.layout();
    });

    // Trigger initial load
    loadMoreGrid(GRID_BATCH_SIZE);

    return () => {
      debug('[Grid:masonryInit] CLEANUP - setting masonryRef to null');
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
  // Create sort key for both tile sizing and scroll reset
  const sortKey = `${sortMode}:${sortDirection}`;
  const sentinelRef = useIntersectionObserver(handleLoadMore, {
    rootMargin: '200px',
    enabled: gridLoadedCount < gridOrderRef.current.length,
    resetKey: sortKey,
  });

  // Handle tile click
  const handleTileClick = useCallback(
    (stem: string) => {
      openViewer(stem);
    },
    [openViewer]
  );

  // Get photos to render based on grid order
  const visibleIndices = gridOrderRef.current.slice(0, gridLoadedCount);
  debug('[Grid:render] gridLoadedCount:', gridLoadedCount, '| gridOrderRef.length:', gridOrderRef.current.length, '| visibleIndices.length:', visibleIndices.length, '| photos.length:', photos.length);

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
              onClick={handleTileClick}
              sortKey={sortKey}
            />
          );
        })}
      </div>
      <div
        ref={sentinelRef}
        class="loading-sentinel"
        style={{ height: '1px', width: '100%', clear: 'both' }}
      />
      <SortControl />
    </main>
  );
}
