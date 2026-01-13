// Virtualized filmstrip component

import { useEffect, useRef, useCallback } from 'preact/hooks';
import { useGalleryStore } from '../../store/galleryStore';
import { FilmstripThumb } from './FilmstripThumb';
import { FILMSTRIP_BUFFER, FILMSTRIP_THUMB_WIDTH } from '../../config';

export function Filmstrip() {
  const photos = useGalleryStore((s) => s.photos);
  const currentPhotoIndex = useGalleryStore((s) => s.currentPhotoIndex);
  const filmstripStart = useGalleryStore((s) => s.filmstripStart);
  const filmstripEnd = useGalleryStore((s) => s.filmstripEnd);
  const setFilmstripRange = useGalleryStore((s) => s.setFilmstripRange);
  const openViewer = useGalleryStore((s) => s.openViewer);

  const containerRef = useRef<HTMLElement>(null);
  const isScrollingToActive = useRef(false);

  // Calculate visible range on scroll
  const updateVisibleRange = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const scrollLeft = container.scrollLeft;
    const viewportWidth = container.clientWidth;

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
  }, [photos.length, filmstripStart, filmstripEnd, setFilmstripRange]);

  // Scroll to active thumbnail when current photo changes
  useEffect(() => {
    const container = containerRef.current;
    if (!container || currentPhotoIndex < 0) return;

    isScrollingToActive.current = true;

    const targetScroll =
      currentPhotoIndex * FILMSTRIP_THUMB_WIDTH -
      container.clientWidth / 2 +
      FILMSTRIP_THUMB_WIDTH / 2;

    container.scrollTo({
      left: Math.max(0, targetScroll),
      behavior: 'smooth',
    });

    // Update visible range after scroll animation
    const timeout = setTimeout(() => {
      isScrollingToActive.current = false;
      updateVisibleRange();
    }, 300);

    return () => clearTimeout(timeout);
  }, [currentPhotoIndex, updateVisibleRange]);

  // Initial visible range calculation
  useEffect(() => {
    updateVisibleRange();
  }, [updateVisibleRange]);

  // Handle scroll events
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
    (index: number) => {
      openViewer(index);
    },
    [openViewer]
  );

  const totalWidth = photos.length * FILMSTRIP_THUMB_WIDTH;

  // Get the range of thumbnails to render
  const visibleRange: number[] = [];
  for (let i = filmstripStart; i < filmstripEnd; i++) {
    visibleRange.push(i);
  }

  return (
    <nav ref={containerRef} class="filmstrip" id="filmstrip">
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
              isActive={index === currentPhotoIndex}
              onClick={handleThumbClick}
            />
          );
        })}
      </div>
    </nav>
  );
}
