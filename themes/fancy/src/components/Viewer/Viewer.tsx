// Photo viewer component

import { useEffect, useRef, useCallback } from 'preact/hooks';
import {
  useGalleryStore,
  useCurrentPhoto,
  useViewerOpen,
} from '../../store/galleryStore';
import { useTouchSwipe } from '../../hooks/useTouchSwipe';
import { useImagePreload } from '../../hooks/useImageLoader';
import { ViewerControls } from '../ViewerControls';
import { ViewerImage } from './ViewerImage';
import { Drawer } from '../Drawer';
import { Filmstrip, FilmstripToggle } from '../Filmstrip';
import { Button } from '../UI';
import { CONTROLS_HIDE_DELAY, getSlideshowDelay } from '../../config';

export function Viewer() {
  const isOpen = useViewerOpen();
  const photo = useCurrentPhoto();
  const photos = useGalleryStore((s) => s.photos);
  const currentPhotoIndex = useGalleryStore((s) => s.currentPhotoIndex);
  const bigPictureMode = useGalleryStore((s) => s.bigPictureMode);
  const drawerOpen = useGalleryStore((s) => s.drawerOpen);
  const slideshowPlaying = useGalleryStore((s) => s.slideshowPlaying);
  const navigatePhoto = useGalleryStore((s) => s.navigatePhoto);
  const closeViewer = useGalleryStore((s) => s.closeViewer);
  const setBigPictureMode = useGalleryStore((s) => s.setBigPictureMode);
  const setSlideshowPlaying = useGalleryStore((s) => s.setSlideshowPlaying);
  const setDrawerOpen = useGalleryStore((s) => s.setDrawerOpen);

  const viewerRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const slideshowTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const preloadImages = useImagePreload();

  // Handle big picture mode fullscreen
  useEffect(() => {
    if (bigPictureMode) {
      // Close drawer in big picture mode
      if (drawerOpen) {
        setDrawerOpen(false);
      }

      // Request fullscreen
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {
          // Fullscreen not available
        });
      }
    } else {
      // Exit fullscreen if in fullscreen
      if (document.fullscreenElement) {
        document.exitFullscreen();
      }
    }
  }, [bigPictureMode, drawerOpen, setDrawerOpen]);

  // Handle fullscreen exit
  useEffect(() => {
    function handleFullscreenChange() {
      if (!document.fullscreenElement && bigPictureMode) {
        setBigPictureMode(false);
        setSlideshowPlaying(false);
      }
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () =>
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [bigPictureMode, setBigPictureMode, setSlideshowPlaying]);

  // Controls auto-hide in big picture mode
  const showControlsTemporarily = useCallback(() => {
    viewerRef.current?.classList.add('controls-visible');

    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }

    controlsTimeoutRef.current = setTimeout(() => {
      if (bigPictureMode) {
        viewerRef.current?.classList.remove('controls-visible');
      }
    }, CONTROLS_HIDE_DELAY);
  }, [bigPictureMode]);

  // Mouse move handler for controls visibility
  useEffect(() => {
    if (!bigPictureMode) {
      viewerRef.current?.classList.remove('controls-visible');
      return;
    }

    const viewer = viewerRef.current;
    if (!viewer) return;

    showControlsTemporarily();

    viewer.addEventListener('mousemove', showControlsTemporarily);
    return () => {
      viewer.removeEventListener('mousemove', showControlsTemporarily);
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [bigPictureMode, showControlsTemporarily]);

  // Slideshow auto-advance
  useEffect(() => {
    if (!slideshowPlaying) {
      if (slideshowTimeoutRef.current) {
        clearTimeout(slideshowTimeoutRef.current);
        slideshowTimeoutRef.current = null;
      }
      return;
    }

    slideshowTimeoutRef.current = setTimeout(() => {
      if (currentPhotoIndex < photos.length - 1) {
        navigatePhoto(1);
      } else {
        // End of gallery, stop slideshow
        setSlideshowPlaying(false);
      }
    }, getSlideshowDelay());

    return () => {
      if (slideshowTimeoutRef.current) {
        clearTimeout(slideshowTimeoutRef.current);
      }
    };
  }, [
    slideshowPlaying,
    currentPhotoIndex,
    photos.length,
    navigatePhoto,
    setSlideshowPlaying,
  ]);

  // Preload adjacent images
  useEffect(() => {
    if (currentPhotoIndex < 0) return;

    const toPreload: string[] = [];
    [
      currentPhotoIndex - 1,
      currentPhotoIndex + 1,
      currentPhotoIndex - 2,
      currentPhotoIndex + 2,
    ].forEach((i) => {
      if (i >= 0 && i < photos.length) {
        toPreload.push(photos[i].imagePath);
      }
    });

    preloadImages(toPreload);
  }, [currentPhotoIndex, photos, preloadImages]);

  // Touch swipe handlers
  const swipeHandlers = useTouchSwipe(
    () => navigatePhoto(1), // swipe left = next
    () => navigatePhoto(-1), // swipe right = prev
    bigPictureMode ? showControlsTemporarily : undefined // tap to show controls
  );

  // Handle backdrop click
  const handleBackdropClick = useCallback(() => {
    closeViewer();
  }, [closeViewer]);

  // Handle prev/next click
  const handlePrevClick = useCallback(() => {
    navigatePhoto(-1);
  }, [navigatePhoto]);

  const handleNextClick = useCallback(() => {
    navigatePhoto(1);
  }, [navigatePhoto]);

  if (!isOpen) return null;

  const viewerClasses = [
    'photo-viewer',
    bigPictureMode && 'big-picture-mode',
    drawerOpen && 'drawer-open',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      ref={viewerRef}
      class={viewerClasses}
      id="photo-viewer"
      onTouchStart={swipeHandlers.onTouchStart}
      onTouchMove={swipeHandlers.onTouchMove}
      onTouchEnd={swipeHandlers.onTouchEnd}
    >
      <div
        class="viewer-backdrop"
        id="viewer-backdrop"
        onClick={handleBackdropClick}
      />

      <ViewerControls />

      <div class="viewer-main">
        <Button
          variant="viewer-nav"
          class="viewer-prev"
          id="viewer-prev"
          aria-label="Previous"
          onClick={handlePrevClick}
          disabled={currentPhotoIndex <= 0}
          dangerouslySetInnerHTML={{ __html: '&lsaquo;' }}
        />

        {photo && <ViewerImage photo={photo} />}

        <Button
          variant="viewer-nav"
          class="viewer-next"
          id="viewer-next"
          aria-label="Next"
          onClick={handleNextClick}
          disabled={currentPhotoIndex >= photos.length - 1}
          dangerouslySetInnerHTML={{ __html: '&rsaquo;' }}
        />
      </div>

      <Drawer />
      <FilmstripToggle />
      <Filmstrip />
    </div>
  );
}
