// Photo viewer component

import { NAVIGATION_DEBOUNCE } from '../config';
import {
  state,
  dom,
  currentImageDownload,
  setCurrentImageDownload,
} from '../state';
import {
  showProgress,
  updateProgress,
  hideProgress,
  loadImageWithProgress,
  calculateViewerImageSize,
} from '../utils/image';
import { updateFilmstripVisibleRange, updateFilmstrip } from './filmstrip';
import { updateDrawerContent } from './drawer';
import { initMap } from './map';
import {
  exitBigPictureMode,
  scheduleSlideshowAdvance,
} from './controls';

export function openViewer(index: number): void {
  if (index < 0 || index >= state.photos.length) return;

  const isFirstOpen = state.currentPhotoIndex < 0;
  state.currentPhotoIndex = index;
  const photo = state.photos[index];

  state.navigationGen++;
  const thisGen = state.navigationGen;

  if (currentImageDownload) {
    currentImageDownload.abort();
    setCurrentImageDownload(null);
  }
  hideProgress();

  window.location.hash = '/photo/' + encodeURIComponent(photo.stem);

  if (dom.viewer) {
    dom.viewer.hidden = false;
  }
  document.body.classList.add('viewer-open');

  const currentImg = dom.viewerImage?.classList.contains('active')
    ? dom.viewerImage
    : dom.viewerImageNext;
  const nextImg =
    currentImg === dom.viewerImage ? dom.viewerImageNext : dom.viewerImage;

  const useCrossfade =
    state.bigPictureMode && !isFirstOpen && dom.viewerImageContainer;

  if (useCrossfade && dom.viewerImageContainer) {
    dom.viewerImageContainer.classList.add('crossfade');
  } else if (dom.viewerImageContainer) {
    dom.viewerImageContainer.classList.remove('crossfade');
  }

  if (!state.bigPictureMode && currentImg && nextImg) {
    const imgSize = calculateViewerImageSize(photo.width, photo.height);
    currentImg.style.width = imgSize.width + 'px';
    currentImg.style.height = imgSize.height + 'px';
    nextImg.style.width = imgSize.width + 'px';
    nextImg.style.height = imgSize.height + 'px';
  } else if (currentImg && nextImg) {
    currentImg.style.width = '';
    currentImg.style.height = '';
    nextImg.style.width = '';
    nextImg.style.height = '';
  }

  let thumbLoaded = false;
  let fullLoaded = false;

  if (useCrossfade && nextImg && currentImg) {
    dom.viewerImageContainer?.classList.remove('loading');

    const thumbImg = new Image();
    thumbImg.onload = () => {
      if (state.navigationGen !== thisGen) return;
      thumbLoaded = true;
      if (fullLoaded) return;

      nextImg.src = photo.thumbPath;
      nextImg.alt = photo.stem;
      currentImg.classList.remove('active');
      nextImg.classList.add('active');
    };
    thumbImg.src = photo.thumbPath;

    let progressStarted = false;
    setTimeout(() => {
      if (state.navigationGen !== thisGen) return;
      if (!fullLoaded) {
        progressStarted = true;
        showProgress();
      }
    }, 150);

    const download = loadImageWithProgress(photo.imagePath, (percent) => {
      if (state.navigationGen !== thisGen) return;
      if (progressStarted) {
        updateProgress(percent);
      }
    });
    setCurrentImageDownload(download);

    download.promise
      .then((blobUrl) => {
        setCurrentImageDownload(null);
        if (state.navigationGen !== thisGen) {
          URL.revokeObjectURL(blobUrl);
          return;
        }
        fullLoaded = true;
        hideProgress();

        nextImg.src = blobUrl;
        nextImg.alt = photo.stem;
        if (!nextImg.classList.contains('active')) {
          currentImg.classList.remove('active');
          nextImg.classList.add('active');
        }
      })
      .catch(() => {
        setCurrentImageDownload(null);
        if (state.navigationGen !== thisGen) return;
        hideProgress();
      });
  } else if (dom.viewerImage) {
    const thumbImg = new Image();
    thumbImg.onload = () => {
      if (state.navigationGen !== thisGen) return;
      thumbLoaded = true;
      if (fullLoaded) return;

      dom.viewerImage!.src = photo.thumbPath;
      dom.viewerImage!.alt = photo.stem;
      dom.viewerImage!.classList.add('active');
      dom.viewerImageNext?.classList.remove('active');

      dom.viewerImageContainer?.classList.remove('loading');
    };
    thumbImg.src = photo.thumbPath;

    let progressStarted = false;
    setTimeout(() => {
      if (state.navigationGen !== thisGen) return;
      if (!fullLoaded) {
        progressStarted = true;
        showProgress();
      }
    }, 150);

    const download = loadImageWithProgress(photo.imagePath, (percent) => {
      if (state.navigationGen !== thisGen) return;
      if (progressStarted) {
        updateProgress(percent);
      }
    });
    setCurrentImageDownload(download);

    download.promise
      .then((blobUrl) => {
        setCurrentImageDownload(null);
        if (state.navigationGen !== thisGen) {
          URL.revokeObjectURL(blobUrl);
          return;
        }
        fullLoaded = true;
        hideProgress();

        dom.viewerImage!.src = blobUrl;
        dom.viewerImage!.alt = photo.stem;
        dom.viewerImage!.classList.add('active');
        dom.viewerImageNext?.classList.remove('active');

        dom.viewerImageContainer?.classList.remove('loading');
      })
      .catch(() => {
        setCurrentImageDownload(null);
        if (state.navigationGen !== thisGen) return;
        hideProgress();
        dom.viewerImageContainer?.classList.remove('loading');
      });

    setTimeout(() => {
      if (state.navigationGen !== thisGen) return;
      if (!thumbLoaded && !fullLoaded && dom.viewerImageContainer) {
        dom.viewerImageContainer.classList.add('loading');
      }
    }, 100);
  }

  updateNavButtons();
  updateFilmstripVisibleRange();
  updateFilmstrip();
  updateDrawerContent(photo);
  preloadAdjacentImages(index);

  if (state.drawerOpen) {
    if (state.map) {
      state.map.remove();
      state.map = null;
    }
    if (
      photo.metadata.gps &&
      photo.metadata.gps.latitude !== null &&
      photo.metadata.gps.longitude !== null
    ) {
      setTimeout(() => {
        initMap(photo.metadata.gps!);
      }, 100);
    }
  }
}

export function closeViewer(): void {
  if (state.bigPictureMode) {
    exitBigPictureMode();
  }

  if (currentImageDownload) {
    currentImageDownload.abort();
    setCurrentImageDownload(null);
  }
  hideProgress();
  state.currentPhotoIndex = -1;
  state.drawerOpen = false;
  if (dom.viewer) {
    dom.viewer.hidden = true;
  }
  dom.viewer?.classList.remove('drawer-open');
  dom.drawerToggle?.classList.remove('active');
  document.body.classList.remove('viewer-open');

  history.replaceState(
    null,
    '',
    window.location.pathname + window.location.search
  );

  if (state.map) {
    state.map.remove();
    state.map = null;
  }
}

export function navigatePhoto(direction: number): void {
  const now = Date.now();
  if (now - state.lastNavigationTime < NAVIGATION_DEBOUNCE) {
    return;
  }
  state.lastNavigationTime = now;

  const newIndex = state.currentPhotoIndex + direction;
  if (newIndex >= 0 && newIndex < state.photos.length) {
    openViewer(newIndex);
    if (state.slideshowPlaying) {
      scheduleSlideshowAdvance();
    }
  }
}

export function updateNavButtons(): void {
  if (dom.viewerPrev) {
    dom.viewerPrev.disabled = state.currentPhotoIndex <= 0;
  }
  if (dom.viewerNext) {
    dom.viewerNext.disabled = state.currentPhotoIndex >= state.photos.length - 1;
  }
}

function preloadAdjacentImages(index: number): void {
  [index - 1, index + 1, index - 2, index + 2].forEach((i) => {
    if (i >= 0 && i < state.photos.length) {
      const img = new Image();
      img.src = state.photos[i].imagePath;
    }
  });
}
