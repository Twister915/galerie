// Keyboard navigation hook

import { useEffect } from 'preact/hooks';
import { useGalleryStore } from '../store/galleryStore';

export function useKeyboardNav(): void {
  const currentPhotoIndex = useGalleryStore((s) => s.currentPhotoIndex);
  const bigPictureMode = useGalleryStore((s) => s.bigPictureMode);
  const drawerOpen = useGalleryStore((s) => s.drawerOpen);
  const navigatePhoto = useGalleryStore((s) => s.navigatePhoto);
  const closeViewer = useGalleryStore((s) => s.closeViewer);
  const toggleDrawer = useGalleryStore((s) => s.toggleDrawer);
  const toggleBigPictureMode = useGalleryStore((s) => s.toggleBigPictureMode);
  const toggleSlideshow = useGalleryStore((s) => s.toggleSlideshow);
  const setBigPictureMode = useGalleryStore((s) => s.setBigPictureMode);
  const setSlideshowPlaying = useGalleryStore((s) => s.setSlideshowPlaying);

  useEffect(() => {
    function handleKeydown(e: KeyboardEvent) {
      // Only handle keys when viewer is open
      if (currentPhotoIndex < 0) return;

      switch (e.key) {
        case 'ArrowLeft':
        case 'ArrowUp':
          e.preventDefault();
          navigatePhoto(-1);
          break;

        case 'ArrowRight':
        case 'ArrowDown':
          e.preventDefault();
          navigatePhoto(1);
          break;

        case 'i':
        case 'I':
          e.preventDefault();
          if (!bigPictureMode) {
            toggleDrawer();
          }
          break;

        case 'f':
        case 'F':
          e.preventDefault();
          toggleBigPictureMode();
          break;

        case ' ':
          if (bigPictureMode) {
            e.preventDefault();
            toggleSlideshow();
          }
          break;

        case 'Escape':
          e.preventDefault();
          if (bigPictureMode) {
            setBigPictureMode(false);
            setSlideshowPlaying(false);
          } else if (drawerOpen) {
            toggleDrawer();
          } else {
            closeViewer();
          }
          break;
      }
    }

    document.addEventListener('keydown', handleKeydown);
    return () => document.removeEventListener('keydown', handleKeydown);
  }, [
    currentPhotoIndex,
    bigPictureMode,
    drawerOpen,
    navigatePhoto,
    closeViewer,
    toggleDrawer,
    toggleBigPictureMode,
    toggleSlideshow,
    setBigPictureMode,
    setSlideshowPlaying,
  ]);
}
