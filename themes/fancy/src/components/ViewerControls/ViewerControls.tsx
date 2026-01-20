// Viewer control buttons (slideshow, fullscreen, info, close)

import { useCallback } from 'preact/hooks';
import { useGalleryStore } from '../../store/galleryStore';
import { Button } from '../UI';

export function ViewerControls() {
  const bigPictureMode = useGalleryStore((s) => s.bigPictureMode);
  const drawerOpen = useGalleryStore((s) => s.drawerOpen);
  const slideshowPlaying = useGalleryStore((s) => s.slideshowPlaying);
  const toggleBigPictureMode = useGalleryStore((s) => s.toggleBigPictureMode);
  const toggleDrawer = useGalleryStore((s) => s.toggleDrawer);
  const toggleSlideshow = useGalleryStore((s) => s.toggleSlideshow);
  const closeViewer = useGalleryStore((s) => s.closeViewer);

  const handleSlideshowClick = useCallback(() => {
    toggleSlideshow();
  }, [toggleSlideshow]);

  const handleBigPictureClick = useCallback(() => {
    toggleBigPictureMode();
  }, [toggleBigPictureMode]);

  const handleDrawerClick = useCallback(() => {
    if (!bigPictureMode) {
      toggleDrawer();
    }
  }, [bigPictureMode, toggleDrawer]);

  const handleCloseClick = useCallback(() => {
    closeViewer();
  }, [closeViewer]);

  return (
    <div class="viewer-controls">
      <Button
        variant="viewer"
        id="big-picture-toggle"
        aria-label="Fullscreen mode"
        onClick={handleBigPictureClick}
        dangerouslySetInnerHTML={{ __html: '&#9974;' }}
      />
      <Button
        variant="viewer"
        class={slideshowPlaying ? 'playing' : undefined}
        id="slideshow-toggle"
        aria-label={slideshowPlaying ? 'Pause slideshow' : 'Play slideshow'}
        onClick={handleSlideshowClick}
        dangerouslySetInnerHTML={{
          __html: slideshowPlaying ? '&#9208;' : '&#9654;',
        }}
      />
      <Button
        variant="viewer"
        active={drawerOpen}
        id="drawer-toggle"
        aria-label="Toggle info"
        onClick={handleDrawerClick}
        disabled={bigPictureMode}
      >
        i
      </Button>
      <Button
        variant="viewer"
        class="viewer-close"
        id="viewer-close"
        aria-label="Close"
        onClick={handleCloseClick}
        dangerouslySetInnerHTML={{ __html: '&times;' }}
      />
    </div>
  );
}
