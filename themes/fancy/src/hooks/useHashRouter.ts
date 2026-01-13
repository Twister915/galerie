// Hash-based routing hook

import { useEffect } from 'preact/hooks';
import { useGalleryStore } from '../store/galleryStore';

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

  useEffect(() => {
    function handleRoute() {
      const hash = window.location.hash.slice(1);
      const route = parseHash(hash);

      switch (route.type) {
        case 'photo': {
          const stem = route.value!;
          const index = photos.findIndex((p) => p.stem === stem);
          if (index >= 0 && index !== currentPhotoIndex) {
            document.body.classList.add('viewer-open');
            setCurrentPhotoIndex(index);
          }
          break;
        }
        case 'album': {
          setFilterAlbum(route.value);
          break;
        }
        case 'none': {
          if (currentPhotoIndex >= 0) {
            closeViewer();
          }
          break;
        }
      }
    }

    // Handle initial route
    handleRoute();

    // Listen for hash changes
    window.addEventListener('hashchange', handleRoute);
    return () => window.removeEventListener('hashchange', handleRoute);
  }, [photos, currentPhotoIndex, setCurrentPhotoIndex, closeViewer, setFilterAlbum]);
}
