// Hash-based routing hook

import { useEffect } from 'preact/hooks';
import { useGalleryStore } from '../store/galleryStore';
import { debug } from '../config';

interface RouteMatch {
  type: 'photo' | 'album' | 'none';
  value: string | null;
}

function parseHash(hash: string): RouteMatch {
  if (!hash) return { type: 'none', value: null };

  const photoMatch = hash.match(/^\/photo\/(.+)$/);
  if (photoMatch) {
    return { type: 'photo', value: decodeURIComponent(photoMatch[1]) };
  }

  const albumMatch = hash.match(/^\/album\/(.+)$/);
  if (albumMatch) {
    return { type: 'album', value: decodeURIComponent(albumMatch[1]) };
  }

  return { type: 'none', value: null };
}

export function useHashRouter(): void {
  const photos = useGalleryStore((s) => s.photos);
  const currentPhotoIndex = useGalleryStore((s) => s.currentPhotoIndex);
  const setCurrentPhotoIndex = useGalleryStore((s) => s.setCurrentPhotoIndex);
  const closeViewer = useGalleryStore((s) => s.closeViewer);
  const setFilterAlbum = useGalleryStore((s) => s.setFilterAlbum);

  // Handle hash changes
  useEffect(() => {
    function handleRoute() {
      const hash = window.location.hash.slice(1);
      const route = parseHash(hash);

      switch (route.type) {
        case 'photo': {
          const photoId = route.value!;
          const index = photos.findIndex((p) => p.htmlPath.replace(/\.html$/, '') === photoId);
          if (index >= 0 && index !== currentPhotoIndex) {
            document.body.classList.add('viewer-open');
            setCurrentPhotoIndex(index);
          }
          break;
        }
        case 'album': {
          // setFilterAlbum already has a guard for same-value updates
          setFilterAlbum(route.value);
          break;
        }
        case 'none': {
          // Clear album filter when navigating away
          setFilterAlbum(null);
          if (currentPhotoIndex >= 0) {
            closeViewer();
          }
          break;
        }
      }
    }

    // Listen for hash changes only - don't run on every render
    window.addEventListener('hashchange', handleRoute);
    return () => window.removeEventListener('hashchange', handleRoute);
  }, [photos, currentPhotoIndex, setCurrentPhotoIndex, closeViewer, setFilterAlbum]);

  // Handle initial route on mount only
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    const route = parseHash(hash);
    debug('[HashRouter:initialEffect] running | hash:', hash, '| route:', route, '| photos.length:', photos.length);

    if (route.type === 'photo') {
      const photoId = route.value!;
      const index = photos.findIndex((p) => p.htmlPath.replace(/\.html$/, '') === photoId);
      debug('[HashRouter:initialEffect] photo route | photoId:', photoId, '| index:', index);
      if (index >= 0) {
        document.body.classList.add('viewer-open');
        setCurrentPhotoIndex(index);
      }
    } else if (route.type === 'album') {
      debug('[HashRouter:initialEffect] album route | calling setFilterAlbum:', route.value);
      setFilterAlbum(route.value);
    }
    // Only run once when photos are loaded
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photos.length > 0]);
}
