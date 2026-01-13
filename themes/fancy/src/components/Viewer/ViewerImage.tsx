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
  const currentImageRef = useRef<HTMLImageElement>(null);
  const nextImageRef = useRef<HTMLImageElement>(null);
  const [activeImage, setActiveImage] = useState<'current' | 'next'>('current');

  // Calculate image dimensions for non-big-picture mode
  const imageSize = useMemo(() => {
    if (bigPictureMode) return null;
    return calculateViewerImageSize(photo.width, photo.height, drawerOpen);
  }, [photo.width, photo.height, bigPictureMode, drawerOpen]);

  // Load new image when photo changes
  useEffect(() => {
    const isFirstLoad = prevPhotoRef.current === null;
    const isNewPhoto = prevPhotoRef.current !== photo.stem;

    if (!isNewPhoto) return;

    prevPhotoRef.current = photo.stem;
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

    // Show progress after delay if full image not loaded
    const progressTimeout = setTimeout(() => {
      if (!imageLoader.src) {
        setShowProgress(true);
      }
    }, 150);

    // Start loading full image
    imageLoader.load(photo.imagePath);

    return () => {
      clearTimeout(progressTimeout);
    };
  }, [photo.stem, photo.thumbPath, photo.imagePath, imageLoader]);

  // Handle crossfade when image loads
  useEffect(() => {
    if (imageLoader.src) {
      setShowProgress(false);
      // Toggle active image for crossfade effect
      if (bigPictureMode) {
        setActiveImage((prev) => (prev === 'current' ? 'next' : 'current'));
      }
    }
  }, [imageLoader.src, bigPictureMode]);

  // Determine what to show
  const displaySrc = imageLoader.src || (thumbLoaded ? photo.thumbPath : null);
  const isLoading = !thumbLoaded && !imageLoader.src;

  const containerClasses = [
    'viewer-image-container',
    isLoading && 'loading',
    bigPictureMode && 'crossfade',
  ]
    .filter(Boolean)
    .join(' ');

  const imageStyle = imageSize
    ? { width: `${imageSize.width}px`, height: `${imageSize.height}px` }
    : undefined;

  return (
    <div class={containerClasses}>
      <img
        ref={currentImageRef}
        class={`viewer-image${activeImage === 'current' ? ' active' : ''}`}
        id="viewer-image"
        src={activeImage === 'current' ? displaySrc || '' : ''}
        alt={photo.stem}
        style={imageStyle}
      />
      <img
        ref={nextImageRef}
        class={`viewer-image${activeImage === 'next' ? ' active' : ''}`}
        id="viewer-image-next"
        src={activeImage === 'next' ? displaySrc || '' : ''}
        alt={photo.stem}
        style={imageStyle}
      />
      <div class={`viewer-progress${showProgress ? ' active' : ''}`} id="viewer-progress">
        <div
          class="viewer-progress-bar"
          id="viewer-progress-bar"
          style={{ width: `${imageLoader.progress}%` }}
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

  // Available space
  const maxHeight = window.innerHeight - filmstripHeight - 100;
  let maxWidth = window.innerWidth * 0.9;

  // Reduce width if drawer is open
  if (drawerOpen) {
    maxWidth = maxWidth - 320;
  }

  // Calculate dimensions maintaining aspect ratio
  const aspectRatio = photoWidth / photoHeight;
  let width: number;
  let height: number;

  // Try fitting by height first
  height = maxHeight;
  width = height * aspectRatio;

  // If too wide, fit by width instead
  if (width > maxWidth) {
    width = maxWidth;
    height = width / aspectRatio;
  }

  return { width: Math.round(width), height: Math.round(height) };
}
