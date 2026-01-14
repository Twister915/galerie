// Viewer image with progressive loading

import { useState, useEffect, useRef, useMemo } from 'preact/hooks';
import { useGalleryStore } from '../../store/galleryStore';
import { useImageLoader } from '../../hooks/useImageLoader';
import type { Photo } from '../../types';

interface ViewerImageProps {
  photo: Photo;
}

export function ViewerImage({ photo }: ViewerImageProps) {
  const bigPictureMode = useGalleryStore((s) => s.bigPictureMode);
  const drawerOpen = useGalleryStore((s) => s.drawerOpen);

  const [thumbLoaded, setThumbLoaded] = useState(false);
  const [showProgress, setShowProgress] = useState(false);
  const imageLoader = useImageLoader();
  const prevPhotoRef = useRef<string | null>(null);
  const fullImageLoadedRef = useRef(false);

  // For crossfade: track which slot is active and what src each slot has
  const [activeSlot, setActiveSlot] = useState<'a' | 'b'>('a');
  const [slotASrc, setSlotASrc] = useState<string | null>(null);
  const [slotBSrc, setSlotBSrc] = useState<string | null>(null);

  // Calculate image dimensions for non-big-picture mode
  const imageSize = useMemo(() => {
    if (bigPictureMode) return null;
    return calculateViewerImageSize(photo.width, photo.height, drawerOpen);
  }, [photo.width, photo.height, bigPictureMode, drawerOpen]);

  // Load new image when photo changes
  useEffect(() => {
    const isNewPhoto = prevPhotoRef.current !== photo.stem;

    if (!isNewPhoto) return;

    prevPhotoRef.current = photo.stem;
    fullImageLoadedRef.current = false;
    setThumbLoaded(false);
    setShowProgress(false);

    // Abort previous download
    imageLoader.abort();

    // Load thumbnail first
    const thumbImg = new Image();
    thumbImg.onload = () => {
      setThumbLoaded(true);
    };
    thumbImg.src = photo.thumbPath;

    // Show progress bar after 400ms if still loading full image
    const progressTimeout = setTimeout(() => {
      if (!fullImageLoadedRef.current) {
        setShowProgress(true);
      }
    }, 400);

    // Start loading full image
    imageLoader.load(photo.imagePath);

    return () => {
      clearTimeout(progressTimeout);
      imageLoader.abort();
    };
  }, [photo.stem, photo.thumbPath, photo.imagePath, imageLoader.load, imageLoader.abort]);

  // Determine current display source
  const displaySrc = imageLoader.src || (thumbLoaded ? photo.thumbPath : null);
  const isShowingThumbnail = !imageLoader.src && thumbLoaded;

  // Update the active slot's source when displaySrc changes
  useEffect(() => {
    if (!displaySrc) return;

    if (bigPictureMode) {
      // In crossfade mode: put new image in inactive slot, then switch
      const inactiveSlot = activeSlot === 'a' ? 'b' : 'a';
      if (inactiveSlot === 'a') {
        setSlotASrc(displaySrc);
      } else {
        setSlotBSrc(displaySrc);
      }
      setActiveSlot(inactiveSlot);
    } else {
      // In normal mode: just update the active slot
      if (activeSlot === 'a') {
        setSlotASrc(displaySrc);
      } else {
        setSlotBSrc(displaySrc);
      }
    }
  }, [displaySrc]); // eslint-disable-line react-hooks/exhaustive-deps

  // Hide progress bar when full image loads
  useEffect(() => {
    if (imageLoader.src) {
      fullImageLoadedRef.current = true;
      setShowProgress(false);
    }
  }, [imageLoader.src]);

  const isLoading = !thumbLoaded && !imageLoader.src;

  const containerClasses = [
    'viewer-image-container',
    isLoading && 'loading',
    bigPictureMode && 'crossfade',
  ]
    .filter(Boolean)
    .join(' ');

  // Apply size to container so it's stable regardless of which image is displayed
  const containerStyle = imageSize
    ? { width: `${imageSize.width}px`, height: `${imageSize.height}px` }
    : undefined;

  return (
    <div class={containerClasses} style={containerStyle}>
      {slotASrc && (
        <img
          class={`viewer-image${activeSlot === 'a' ? ' active' : ''}`}
          id="viewer-image"
          src={slotASrc}
          alt=""
        />
      )}
      {slotBSrc && (
        <img
          class={`viewer-image${activeSlot === 'b' ? ' active' : ''}`}
          id="viewer-image-next"
          src={slotBSrc}
          alt=""
        />
      )}
      <div class={`viewer-progress${showProgress ? ' active' : ''}`} id="viewer-progress">
        <div
          class={`viewer-progress-bar${imageLoader.indeterminate ? ' indeterminate' : ''}`}
          id="viewer-progress-bar"
          style={imageLoader.indeterminate ? undefined : { width: `${imageLoader.progress}%` }}
        />
      </div>
    </div>
  );
}

// Calculate image dimensions to fit viewport
function calculateViewerImageSize(
  photoWidth: number,
  photoHeight: number,
  drawerOpen: boolean
): { width: number; height: number } {
  // Get filmstrip height from CSS variable
  let filmstripHeight = 80;
  const computed = getComputedStyle(document.documentElement);
  const filmstripVar = computed.getPropertyValue('--filmstrip-height');
  if (filmstripVar) {
    filmstripHeight = parseInt(filmstripVar, 10) || 80;
  }

  const isMobile = window.innerWidth <= 1024;
  const aspectRatio = photoWidth / photoHeight;

  if (isMobile && drawerOpen) {
    // Mobile with drawer: fill width edge-to-edge, constrain height to available space
    const maxWidth = window.innerWidth;
    // Available height: from top to filmstrip (which sits at 50vh - filmstripHeight)
    const maxHeight = window.innerHeight * 0.5 - filmstripHeight;

    // Start with full width
    let width = maxWidth;
    let height = width / aspectRatio;

    // Only constrain by height for very tall (portrait) images
    if (height > maxHeight) {
      height = maxHeight;
      width = height * aspectRatio;
    }

    return { width: Math.round(width), height: Math.round(height) };
  }

  // Desktop or mobile without drawer
  const maxHeight = window.innerHeight - filmstripHeight - 100;
  let maxWidth = window.innerWidth * 0.9;

  if (drawerOpen) {
    maxWidth = maxWidth - 320;
  }

  // Try fitting by height first
  let height = maxHeight;
  let width = height * aspectRatio;

  // If too wide, fit by width instead
  if (width > maxWidth) {
    width = maxWidth;
    height = width / aspectRatio;
  }

  return { width: Math.round(width), height: Math.round(height) };
}
