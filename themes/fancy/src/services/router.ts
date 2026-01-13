// Hash-based routing

import { state } from '../state';
import { openViewer, closeViewer } from '../components/viewer';

export function handleRoute(): void {
  const hash = window.location.hash.slice(1);

  if (!hash) {
    if (state.currentPhotoIndex >= 0) {
      closeViewer();
    }
    return;
  }

  const photoMatch = hash.match(/^\/photo\/(.+)$/);
  if (photoMatch) {
    const stem = decodeURIComponent(photoMatch[1]);
    let index = -1;
    for (let i = 0; i < state.photos.length; i++) {
      if (state.photos[i].stem === stem) {
        index = i;
        break;
      }
    }
    if (index >= 0 && index !== state.currentPhotoIndex) {
      openViewer(index);
    }
    return;
  }

  const albumMatch = hash.match(/^\/album\/(.+)$/);
  if (albumMatch) {
    const slug = decodeURIComponent(albumMatch[1]);
    filterByAlbum(slug);
  }
}

function filterByAlbum(slug: string): void {
  state.filterAlbum = slug;
  const links = document.querySelectorAll('.album-link');
  for (const link of links) {
    link.classList.toggle(
      'active',
      (link as HTMLElement).dataset.album === slug
    );
  }
}
