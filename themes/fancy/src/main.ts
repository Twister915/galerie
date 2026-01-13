// Galerie Fancy Theme - Single Page Application
// Entry point

import '../styles/main.scss';

import { state, dom, cacheDomElements, touchState } from './state';
import { SWIPE_THRESHOLD, SWIPE_TIME_LIMIT } from './config';
import { galleryData, loadData } from './services/data';
import { setupLangPicker } from './services/i18n';
import { handleRoute } from './services/router';
import { simpleHash } from './utils/hash';
import { calculateViewerImageSize } from './utils/image';
import { setupGrid } from './components/grid';
import { setupFilmstrip } from './components/filmstrip';
import { openViewer, closeViewer, navigatePhoto } from './components/viewer';
import { toggleDrawer } from './components/drawer';
import {
  toggleBigPictureMode,
  toggleSlideshow,
  exitBigPictureMode,
  showControlsTemporarily,
} from './components/controls';

function initApp(): void {
  if (!galleryData) {
    console.error('Gallery data not loaded');
    return;
  }

  state.photos = galleryData.photos;
  state.albums = galleryData.albums;
  state.site = galleryData.site;

  state.gridOrder = state.photos
    .map((photo, index) => ({ index, sortKey: simpleHash(photo.hash) }))
    .sort((a, b) => a.sortKey - b.sortKey)
    .map((item) => item.index);

  cacheDomElements();
  setupGrid();
  setupFilmstrip();
  setupLangPicker();
  setupEventListeners();
  handleRoute();
}

function setupEventListeners(): void {
  dom.grid?.addEventListener('click', (e) => {
    const tile = (e.target as Element).closest('.photo-tile') as HTMLElement;
    if (tile) {
      const index = parseInt(tile.dataset.index || '0', 10);
      openViewer(index);
    }
  });

  dom.viewerClose?.addEventListener('click', closeViewer);
  dom.viewerBackdrop?.addEventListener('click', closeViewer);
  dom.viewerPrev?.addEventListener('click', () => navigatePhoto(-1));
  dom.viewerNext?.addEventListener('click', () => navigatePhoto(1));
  dom.drawerToggle?.addEventListener('click', toggleDrawer);

  dom.bigPictureToggle?.addEventListener('click', toggleBigPictureMode);
  dom.slideshowToggle?.addEventListener('click', toggleSlideshow);

  dom.filmstrip?.addEventListener('click', (e) => {
    const thumb = (e.target as Element).closest(
      '.filmstrip-thumb'
    ) as HTMLElement;
    if (thumb) {
      const index = parseInt(thumb.dataset.index || '0', 10);
      openViewer(index);
    }
  });

  // Touch events for swipe navigation
  dom.viewer?.addEventListener('touchstart', handleTouchStart, {
    passive: true,
  });
  dom.viewer?.addEventListener('touchmove', handleTouchMove, { passive: false });
  dom.viewer?.addEventListener('touchend', handleTouchEnd, { passive: true });

  document.addEventListener('keydown', handleKeydown);
  window.addEventListener('hashchange', handleRoute);

  // Header hide on scroll
  let lastScrollY = 0;
  window.addEventListener(
    'scroll',
    () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY > lastScrollY && currentScrollY > 60) {
        dom.header?.classList.add('hidden');
      } else {
        dom.header?.classList.remove('hidden');
      }
      lastScrollY = currentScrollY;
    },
    { passive: true }
  );

  // Resize handler
  let resizeTimeout: ReturnType<typeof setTimeout>;
  window.addEventListener(
    'resize',
    () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        if (state.currentPhotoIndex >= 0 && !state.bigPictureMode) {
          const photo = state.photos[state.currentPhotoIndex];
          const imgSize = calculateViewerImageSize(photo.width, photo.height);
          if (dom.viewerImage) {
            dom.viewerImage.style.width = imgSize.width + 'px';
            dom.viewerImage.style.height = imgSize.height + 'px';
          }
          if (dom.viewerImageNext) {
            dom.viewerImageNext.style.width = imgSize.width + 'px';
            dom.viewerImageNext.style.height = imgSize.height + 'px';
          }
        }
      }, 100);
    },
    { passive: true }
  );
}

function handleTouchStart(e: TouchEvent): void {
  if (state.currentPhotoIndex < 0) return;

  touchState.startX = e.touches[0].clientX;
  touchState.startY = e.touches[0].clientY;
  touchState.startTime = Date.now();

  if (state.bigPictureMode) {
    showControlsTemporarily();
  }
}

function handleTouchMove(e: TouchEvent): void {
  if (state.currentPhotoIndex < 0) return;

  const deltaX = e.touches[0].clientX - touchState.startX;
  const deltaY = e.touches[0].clientY - touchState.startY;

  if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 10) {
    e.preventDefault();
  }
}

function handleTouchEnd(e: TouchEvent): void {
  if (state.currentPhotoIndex < 0) return;

  const deltaX = e.changedTouches[0].clientX - touchState.startX;
  const deltaY = e.changedTouches[0].clientY - touchState.startY;
  const deltaTime = Date.now() - touchState.startTime;

  if (
    deltaTime < SWIPE_TIME_LIMIT &&
    Math.abs(deltaX) > SWIPE_THRESHOLD &&
    Math.abs(deltaX) > Math.abs(deltaY)
  ) {
    if (deltaX > 0) {
      navigatePhoto(-1);
    } else {
      navigatePhoto(1);
    }
  }
}

function handleKeydown(e: KeyboardEvent): void {
  if (state.currentPhotoIndex < 0) return;

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
      if (!state.bigPictureMode) {
        toggleDrawer();
      }
      break;
    case 'f':
    case 'F':
      e.preventDefault();
      toggleBigPictureMode();
      break;
    case ' ':
      if (state.bigPictureMode) {
        e.preventDefault();
        toggleSlideshow();
      }
      break;
    case 'Escape':
      e.preventDefault();
      if (state.bigPictureMode) {
        exitBigPictureMode();
      } else if (state.drawerOpen) {
        toggleDrawer();
      } else {
        closeViewer();
      }
      break;
  }
}

function start(): void {
  document.body.classList.add('loading');

  loadData()
    .then(() => {
      document.body.classList.remove('loading');
      initApp();
    })
    .catch((err) => {
      console.error('Failed to load gallery data:', err);
      document.body.classList.remove('loading');
      document.body.classList.add('error');
    });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start);
} else {
  start();
}
