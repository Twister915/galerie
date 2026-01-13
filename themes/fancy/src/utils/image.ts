// Image loading with progress tracking

import { dom, state } from '../state';
import type { ImageDownload } from '../types';

export function showProgress(): void {
  if (dom.viewerProgress && dom.viewerProgressBar) {
    dom.viewerProgressBar.style.width = '0%';
    dom.viewerProgress.classList.add('active');
  }
}

export function updateProgress(percent: number): void {
  if (dom.viewerProgressBar) {
    dom.viewerProgressBar.style.width = percent + '%';
  }
}

export function hideProgress(): void {
  if (dom.viewerProgress) {
    dom.viewerProgress.classList.remove('active');
  }
}

export function loadImageWithProgress(
  url: string,
  onProgress?: (percent: number) => void
): ImageDownload {
  const xhr = new XMLHttpRequest();

  const promise = new Promise<string>((resolve, reject) => {
    xhr.open('GET', url, true);
    xhr.responseType = 'blob';

    xhr.onprogress = (e: ProgressEvent) => {
      if (e.lengthComputable && onProgress) {
        const percent = Math.round((e.loaded / e.total) * 100);
        onProgress(percent);
      }
    };

    xhr.onload = () => {
      if (xhr.status === 200) {
        const blobUrl = URL.createObjectURL(xhr.response as Blob);
        resolve(blobUrl);
      } else {
        reject(new Error('Failed to load image: ' + xhr.status));
      }
    };

    xhr.onerror = () => {
      reject(new Error('Network error loading image'));
    };

    xhr.onabort = () => {
      reject(new Error('Download aborted'));
    };

    xhr.send();
  });

  return {
    promise,
    abort: () => xhr.abort(),
  };
}

export function calculateViewerImageSize(
  photoWidth: number,
  photoHeight: number
): { width: number; height: number } {
  // Get filmstrip height from CSS variable
  let filmstripHeight = 80;
  const computed = getComputedStyle(document.documentElement);
  const filmstripVar = computed.getPropertyValue('--filmstrip-height');
  if (filmstripVar) {
    filmstripHeight = parseInt(filmstripVar, 10) || 80;
  }

  // Available space (matching CSS constraints)
  const maxHeight = window.innerHeight - filmstripHeight - 100;
  let maxWidth = window.innerWidth * 0.9;

  // If drawer is open, reduce available width
  if (state.drawerOpen) {
    maxWidth = maxWidth - 320;
  }

  // Calculate dimensions that fit within constraints while maintaining aspect ratio
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
