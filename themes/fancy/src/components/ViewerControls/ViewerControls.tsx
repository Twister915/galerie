// Viewer control buttons (slideshow, fullscreen, info, close)

import { useCallback } from 'preact/hooks';
import { useGalleryStore } from '../../store/galleryStore';

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
      <button
        class="viewer-btn"
        id="big-picture-toggle"
        aria-label="Fullscreen mode"
        onClick={handleBigPictureClick}
        dangerouslySetInnerHTML={{ __html: '&#9974;' }}
      />
      <button
        class={`viewer-btn${slideshowPlaying ? ' playing' : ''}`}
        id="slideshow-toggle"
        aria-label={slideshowPlaying ? 'Pause slideshow' : 'Play slideshow'}
        onClick={handleSlideshowClick}
        dangerouslySetInnerHTML={{
          __html: slideshowPlaying ? '&#9208;' : '&#9654;',
        }}
      />
      <button
        class={`viewer-btn${drawerOpen ? ' active' : ''}`}
        id="drawer-toggle"
        aria-label="Toggle info"
        onClick={handleDrawerClick}
        disabled={bigPictureMode}
      >
        i
      </button>
      <button
        class="viewer-btn viewer-close"
        id="viewer-close"
        aria-label="Close"
        onClick={handleCloseClick}
        dangerouslySetInnerHTML={{ __html: '&times;' }}
      />
    </div>
  );
}
