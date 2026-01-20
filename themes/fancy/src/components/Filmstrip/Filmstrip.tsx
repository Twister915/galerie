// Virtualized filmstrip component

import { useEffect, useRef, useCallback, useMemo } from 'preact/hooks';
import { useGalleryStore } from '../../store/galleryStore';
import { FilmstripThumb } from './FilmstripThumb';
import { FILMSTRIP_BUFFER, FILMSTRIP_THUMB_WIDTH } from '../../config';

export function Filmstrip() {
  const mainPhotos = useGalleryStore((s) => s.photos);

  // Sort photos by capture date (oldest first, newest last)
  // Memoized to only recompute when mainPhotos changes
  const photos = useMemo(() => {
    return [...mainPhotos].sort((a, b) => {
      const dateA = a.metadata.dateTaken || '';
      const dateB = b.metadata.dateTaken || '';
      return dateA.localeCompare(dateB);
    });
  }, [mainPhotos]);
  const currentPhotoIndex = useGalleryStore((s) => s.currentPhotoIndex);
  const filmstripStart = useGalleryStore((s) => s.filmstripStart);
  const filmstripEnd = useGalleryStore((s) => s.filmstripEnd);
  const filmstripCollapsed = useGalleryStore((s) => s.filmstripCollapsed);
  const setFilmstripRange = useGalleryStore((s) => s.setFilmstripRange);
  const openViewer = useGalleryStore((s) => s.openViewer);

  // Find active photo's position in the filmstrip's sorted order
  const currentPhoto = currentPhotoIndex >= 0 ? mainPhotos[currentPhotoIndex] : null;
  const activeFilmstripIndex = useMemo(() => {
    if (!currentPhoto) return -1;
    return photos.findIndex((p) => p.stem === currentPhoto.stem);
  }, [photos, currentPhoto]);

  const containerRef = useRef<HTMLElement>(null);
  const isScrollingToActive = useRef(false);
  const scrollingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Calculate visible range based on a scroll position
  const updateVisibleRangeForScroll = useCallback(
    (scrollLeft: number, viewportWidth: number) => {
      const newStart = Math.max(
        0,
        Math.floor(scrollLeft / FILMSTRIP_THUMB_WIDTH) - FILMSTRIP_BUFFER
      );
      const newEnd = Math.min(
        photos.length,
        Math.ceil((scrollLeft + viewportWidth) / FILMSTRIP_THUMB_WIDTH) +
          FILMSTRIP_BUFFER
      );

      if (newStart !== filmstripStart || newEnd !== filmstripEnd) {
        setFilmstripRange(newStart, newEnd);
      }
    },
    [photos.length, filmstripStart, filmstripEnd, setFilmstripRange]
  );

  // Calculate visible range from current scroll position
  const updateVisibleRange = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    updateVisibleRangeForScroll(container.scrollLeft, container.clientWidth);
  }, [updateVisibleRangeForScroll]);

  // Scroll to active thumbnail when current photo changes
  useEffect(() => {
    const container = containerRef.current;
    if (!container || activeFilmstripIndex < 0) return;

    isScrollingToActive.current = true;

    const viewportWidth = container.clientWidth;
    const targetScroll = Math.max(
      0,
      activeFilmstripIndex * FILMSTRIP_THUMB_WIDTH -
        viewportWidth / 2 +
        FILMSTRIP_THUMB_WIDTH / 2
    );

    // Update visible range immediately based on target position
    updateVisibleRangeForScroll(targetScroll, viewportWidth);

    container.scrollTo({
      left: targetScroll,
      behavior: 'smooth',
    });

    // Clear any existing timeout
    if (scrollingTimeoutRef.current) {
      clearTimeout(scrollingTimeoutRef.current);
    }

    // Reset flag after scroll animation completes
    scrollingTimeoutRef.current = setTimeout(() => {
      isScrollingToActive.current = false;
    }, 300);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFilmstripIndex]);

  // Initial visible range calculation
  useEffect(() => {
    updateVisibleRange();
  }, [updateVisibleRange]);

  // Handle scroll events (for manual scrolling)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    function handleScroll() {
      if (!isScrollingToActive.current) {
        updateVisibleRange();
      }
    }

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [updateVisibleRange]);

  // Handle thumbnail click
  const handleThumbClick = useCallback(
    (filmstripIndex: number) => {
      const photo = photos[filmstripIndex];
      if (!photo) return;
      openViewer(photo.stem);
    },
    [photos, openViewer]
  );

  const totalWidth = photos.length * FILMSTRIP_THUMB_WIDTH;

  // Get the range of thumbnails to render
  const visibleRange: number[] = [];
  for (let i = filmstripStart; i < filmstripEnd; i++) {
    visibleRange.push(i);
  }

  const filmstripClasses = ['filmstrip', filmstripCollapsed && 'collapsed']
    .filter(Boolean)
    .join(' ');

  return (
    <nav ref={containerRef} class={filmstripClasses} id="filmstrip">
      <div
        class="filmstrip-track"
        style={{
          display: 'flex',
          gap: '8px',
          position: 'relative',
          width: `${totalWidth}px`,
        }}
      >
        {visibleRange.map((index) => {
          const photo = photos[index];
          if (!photo) return null;
          return (
            <FilmstripThumb
              key={photo.stem}
              photo={photo}
              index={index}
              isActive={index === activeFilmstripIndex}
              onClick={handleThumbClick}
            />
          );
        })}
      </div>
    </nav>
  );
}
