// Big picture mode and slideshow controls

import { CONTROLS_HIDE_DELAY, SLIDESHOW_DELAY } from '../config';
import { state, dom } from '../state';
import { navigatePhoto } from './viewer';
import { calculateViewerImageSize } from '../utils/image';

export function enterBigPictureMode(): void {
  state.bigPictureMode = true;
  dom.viewer?.classList.add('big-picture-mode');

  // Clear explicit dimensions so CSS can handle full-screen sizing
  if (dom.viewerImage) {
    dom.viewerImage.style.width = '';
    dom.viewerImage.style.height = '';
  }
  if (dom.viewerImageNext) {
    dom.viewerImageNext.style.width = '';
    dom.viewerImageNext.style.height = '';
  }

  // Close drawer if open
  if (state.drawerOpen) {
    state.drawerOpen = false;
    dom.viewer?.classList.remove('drawer-open');
    dom.drawerToggle?.classList.remove('active');
  }

  // Request fullscreen on desktop
  if (document.documentElement.requestFullscreen) {
    document.documentElement.requestFullscreen().catch(() => {
      // Fullscreen not available, continue anyway
    });
  }

  showControlsTemporarily();
  setupBigPictureModeListeners();
}

export function exitBigPictureMode(): void {
  state.bigPictureMode = false;
  stopSlideshow();
  dom.viewer?.classList.remove('big-picture-mode');
  dom.viewer?.classList.remove('controls-visible');

  // Remove crossfade mode
  if (dom.viewerImageContainer) {
    dom.viewerImageContainer.classList.remove('crossfade');
  }

  // Restore explicit dimensions for normal viewer mode
  if (state.currentPhotoIndex >= 0) {
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

  if (document.fullscreenElement) {
    document.exitFullscreen();
  }

  if (state.controlsTimeout) {
    clearTimeout(state.controlsTimeout);
  }
  removeBigPictureModeListeners();
}

export function showControlsTemporarily(): void {
  dom.viewer?.classList.add('controls-visible');

  if (state.controlsTimeout) {
    clearTimeout(state.controlsTimeout);
  }
  state.controlsTimeout = setTimeout(() => {
    if (state.bigPictureMode) {
      dom.viewer?.classList.remove('controls-visible');
    }
  }, CONTROLS_HIDE_DELAY);
}

function setupBigPictureModeListeners(): void {
  dom.viewer?.addEventListener('mousemove', showControlsTemporarily);
  document.addEventListener('fullscreenchange', handleFullscreenChange);
}

function removeBigPictureModeListeners(): void {
  dom.viewer?.removeEventListener('mousemove', showControlsTemporarily);
  document.removeEventListener('fullscreenchange', handleFullscreenChange);
}

function handleFullscreenChange(): void {
  if (!document.fullscreenElement && state.bigPictureMode) {
    exitBigPictureMode();
  }
}

export function toggleBigPictureMode(): void {
  if (state.bigPictureMode) {
    exitBigPictureMode();
  } else {
    enterBigPictureMode();
  }
}

export function startSlideshow(): void {
  state.slideshowPlaying = true;
  if (dom.slideshowToggle) {
    dom.slideshowToggle.classList.add('playing');
    dom.slideshowToggle.innerHTML = '&#9208;'; // Pause icon
    dom.slideshowToggle.setAttribute('aria-label', 'Pause slideshow');
  }

  scheduleSlideshowAdvance();
}

export function scheduleSlideshowAdvance(): void {
  if (state.slideshowInterval) {
    clearTimeout(state.slideshowInterval);
  }

  state.slideshowInterval = setTimeout(() => {
    if (
      state.slideshowPlaying &&
      state.currentPhotoIndex < state.photos.length - 1
    ) {
      navigatePhoto(1);
      scheduleSlideshowAdvance();
    } else if (state.slideshowPlaying) {
      stopSlideshow();
    }
  }, SLIDESHOW_DELAY);
}

export function stopSlideshow(): void {
  state.slideshowPlaying = false;
  if (dom.slideshowToggle) {
    dom.slideshowToggle.classList.remove('playing');
    dom.slideshowToggle.innerHTML = '&#9654;'; // Play icon
    dom.slideshowToggle.setAttribute('aria-label', 'Play slideshow');
  }

  if (state.slideshowInterval) {
    clearTimeout(state.slideshowInterval);
    state.slideshowInterval = null;
  }
}

export function toggleSlideshow(): void {
  if (state.slideshowPlaying) {
    stopSlideshow();
  } else {
    startSlideshow();
  }
}
