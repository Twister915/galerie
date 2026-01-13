// Masonry grid with progressive loading

import { GRID_BATCH_SIZE } from '../config';
import { state, dom } from '../state';
import type { Photo } from '../types';

function getTileSizeClass(hash: string): string {
  const value = parseInt(hash.substring(0, 2), 16);
  if (value < 25) return 'size-4x';
  if (value < 102) return 'size-2x';
  return 'size-1x';
}

export function setupGrid(): void {
  if (!dom.grid) return;

  dom.grid.innerHTML =
    '<div class="grid-sizer"></div><div class="gutter-sizer"></div>';

  dom.loadingSentinel = document.createElement('div');
  dom.loadingSentinel.className = 'loading-sentinel';
  dom.loadingSentinel.style.cssText = 'height:1px;width:100%;clear:both;';

  loadMorePhotos();

  state.masonry = new window.Masonry(dom.grid, {
    itemSelector: '.photo-tile',
    columnWidth: '.grid-sizer',
    gutter: '.gutter-sizer',
    fitWidth: true,
    transitionDuration: 0,
    initLayout: false,
  });

  requestAnimationFrame(() => {
    state.masonry?.layout();
  });

  state.gridObserver = new IntersectionObserver(
    (entries) => {
      if (entries[0].isIntersecting && !state.gridLoading) {
        loadMorePhotos();
      }
    },
    { rootMargin: '200px' }
  );

  dom.grid.parentNode?.insertBefore(dom.loadingSentinel, dom.grid.nextSibling);
  state.gridObserver.observe(dom.loadingSentinel);
}

export function loadMorePhotos(): void {
  if (!dom.grid) return;
  if (state.gridLoadedCount >= state.gridOrder.length) {
    if (dom.loadingSentinel?.parentNode) {
      dom.loadingSentinel.parentNode.removeChild(dom.loadingSentinel);
    }
    return;
  }

  state.gridLoading = true;

  const startIndex = state.gridLoadedCount;
  const endIndex = Math.min(startIndex + GRID_BATCH_SIZE, state.gridOrder.length);
  const fragment = document.createDocumentFragment();
  const newTiles: HTMLElement[] = [];

  for (let i = startIndex; i < endIndex; i++) {
    const photoIndex = state.gridOrder[i];
    const photo = state.photos[photoIndex];
    const tile = createTile(photo, photoIndex);
    fragment.appendChild(tile);
    newTiles.push(tile);
  }

  dom.grid.appendChild(fragment);
  state.gridLoadedCount = endIndex;

  if (state.masonry && newTiles.length > 0) {
    state.masonry.appended(newTiles);

    window.imagesLoaded(newTiles, () => {
      state.masonry?.layout();
    });
  }

  state.gridLoading = false;
}

function createTile(photo: Photo, index: number): HTMLElement {
  const sizeClass = getTileSizeClass(photo.hash);

  const tile = document.createElement('div');
  tile.className = 'photo-tile ' + sizeClass;
  tile.dataset.index = String(index);
  tile.dataset.stem = photo.stem;

  const img = document.createElement('img');
  img.src = photo.thumbPath;
  img.alt = photo.stem;
  img.loading = 'lazy';
  img.decoding = 'async';

  if (photo.width && photo.height) {
    img.style.aspectRatio = photo.width + ' / ' + photo.height;
  }

  tile.appendChild(img);
  return tile;
}
