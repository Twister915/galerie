// Virtualized filmstrip component

import { FILMSTRIP_BUFFER, FILMSTRIP_THUMB_WIDTH } from '../config';
import { state, dom } from '../state';

export function setupFilmstrip(): void {
  if (!dom.filmstrip) return;

  dom.filmstripTrack = document.createElement('div');
  dom.filmstripTrack.className = 'filmstrip-track';
  dom.filmstripTrack.style.cssText = 'display:flex;gap:8px;position:relative;';

  const totalWidth = state.photos.length * FILMSTRIP_THUMB_WIDTH;
  dom.filmstripTrack.style.width = totalWidth + 'px';

  dom.filmstrip.appendChild(dom.filmstripTrack);

  dom.filmstrip.addEventListener('scroll', updateFilmstripVisibleRange, {
    passive: true,
  });
}

export function updateFilmstripVisibleRange(): void {
  if (!dom.filmstrip || !dom.filmstripTrack) return;

  const scrollLeft = dom.filmstrip.scrollLeft;
  const viewportWidth = dom.filmstrip.clientWidth;

  const startIndex = Math.max(
    0,
    Math.floor(scrollLeft / FILMSTRIP_THUMB_WIDTH) - FILMSTRIP_BUFFER
  );
  const endIndex = Math.min(
    state.photos.length,
    Math.ceil((scrollLeft + viewportWidth) / FILMSTRIP_THUMB_WIDTH) +
      FILMSTRIP_BUFFER
  );

  if (startIndex === state.filmstripStart && endIndex === state.filmstripEnd) {
    return;
  }

  state.filmstripStart = startIndex;
  state.filmstripEnd = endIndex;

  renderFilmstripRange(startIndex, endIndex);
}

function renderFilmstripRange(start: number, end: number): void {
  if (!dom.filmstripTrack) return;

  dom.filmstripTrack.innerHTML = '';

  const fragment = document.createDocumentFragment();

  for (let i = start; i < end; i++) {
    const photo = state.photos[i];

    const thumb = document.createElement('div');
    thumb.className =
      'filmstrip-thumb' + (i === state.currentPhotoIndex ? ' active' : '');
    thumb.dataset.index = String(i);
    thumb.style.cssText =
      'position:absolute;left:' + i * FILMSTRIP_THUMB_WIDTH + 'px;';

    const img = document.createElement('img');
    img.src = photo.microThumbPath;
    img.alt = photo.stem;
    (img as HTMLImageElement & { fetchPriority: string }).fetchPriority = 'low';

    thumb.appendChild(img);
    fragment.appendChild(thumb);
  }

  dom.filmstripTrack.appendChild(fragment);
}

export function updateFilmstrip(): void {
  if (!dom.filmstripTrack) return;

  const thumbs = dom.filmstripTrack.querySelectorAll('.filmstrip-thumb');
  for (const thumb of thumbs) {
    const idx = parseInt((thumb as HTMLElement).dataset.index || '0', 10);
    thumb.classList.toggle('active', idx === state.currentPhotoIndex);
  }
  scrollFilmstripToActive();
}

export function scrollFilmstripToActive(): void {
  if (!dom.filmstrip || state.currentPhotoIndex < 0) return;

  const targetScroll =
    state.currentPhotoIndex * FILMSTRIP_THUMB_WIDTH -
    dom.filmstrip.clientWidth / 2 +
    FILMSTRIP_THUMB_WIDTH / 2;

  dom.filmstrip.scrollTo({
    left: Math.max(0, targetScroll),
    behavior: 'smooth',
  });

  setTimeout(updateFilmstripVisibleRange, 50);
}
