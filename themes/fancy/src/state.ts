// Central state management

import type * as L from 'leaflet';
import type {
  Photo,
  Album,
  SiteInfo,
  TouchState,
  DomElements,
  MasonryInstance,
  ImageDownload,
} from './types';

export interface AppState {
  photos: Photo[];
  gridOrder: number[];
  albums: Album[];
  site: SiteInfo;
  currentPhotoIndex: number;
  drawerOpen: boolean;
  masonry: MasonryInstance | null;
  map: L.Map | null;
  filterAlbum: string | null;
  gridLoadedCount: number;
  gridLoading: boolean;
  gridObserver: IntersectionObserver | null;
  filmstripStart: number;
  filmstripEnd: number;
  bigPictureMode: boolean;
  controlsTimeout: ReturnType<typeof setTimeout> | null;
  slideshowPlaying: boolean;
  slideshowInterval: ReturnType<typeof setTimeout> | null;
  navigationGen: number;
  lastNavigationTime: number;
}

export const state: AppState = {
  photos: [],
  gridOrder: [],
  albums: [],
  site: { domain: '', title: '', version: '' },
  currentPhotoIndex: -1,
  drawerOpen: false,
  masonry: null,
  map: null,
  filterAlbum: null,
  gridLoadedCount: 0,
  gridLoading: false,
  gridObserver: null,
  filmstripStart: 0,
  filmstripEnd: 0,
  bigPictureMode: false,
  controlsTimeout: null,
  slideshowPlaying: false,
  slideshowInterval: null,
  navigationGen: 0,
  lastNavigationTime: 0,
};

export const touchState: TouchState = {
  startX: 0,
  startY: 0,
  startTime: 0,
};

export const dom: DomElements = {
  header: null,
  gallery: null,
  grid: null,
  viewer: null,
  viewerBackdrop: null,
  viewerImage: null,
  viewerImageNext: null,
  viewerImageContainer: null,
  viewerClose: null,
  viewerPrev: null,
  viewerNext: null,
  infoDrawer: null,
  drawerToggle: null,
  drawerContent: null,
  filmstrip: null,
  filmstripTrack: null,
  loadingSentinel: null,
  bigPictureToggle: null,
  slideshowToggle: null,
  viewerProgress: null,
  viewerProgressBar: null,
};

// Current full-res image download (for aborting on navigation)
export let currentImageDownload: ImageDownload | null = null;

export function setCurrentImageDownload(download: ImageDownload | null): void {
  currentImageDownload = download;
}

export function cacheDomElements(): void {
  dom.header = document.querySelector('.site-header');
  dom.gallery = document.getElementById('gallery');
  dom.grid = document.getElementById('masonry-grid');
  dom.viewer = document.getElementById('photo-viewer');
  dom.viewerBackdrop = document.getElementById('viewer-backdrop');
  dom.viewerImage = document.getElementById('viewer-image') as HTMLImageElement;
  dom.viewerImageNext = document.getElementById(
    'viewer-image-next'
  ) as HTMLImageElement;
  dom.viewerImageContainer = dom.viewerImage?.parentElement ?? null;
  dom.viewerClose = document.getElementById(
    'viewer-close'
  ) as HTMLButtonElement;
  dom.viewerPrev = document.getElementById('viewer-prev') as HTMLButtonElement;
  dom.viewerNext = document.getElementById('viewer-next') as HTMLButtonElement;
  dom.infoDrawer = document.getElementById('info-drawer');
  dom.drawerToggle = document.getElementById(
    'drawer-toggle'
  ) as HTMLButtonElement;
  dom.drawerContent = document.getElementById('drawer-content');
  dom.filmstrip = document.getElementById('filmstrip');
  dom.bigPictureToggle = document.getElementById(
    'big-picture-toggle'
  ) as HTMLButtonElement;
  dom.slideshowToggle = document.getElementById(
    'slideshow-toggle'
  ) as HTMLButtonElement;
  dom.viewerProgress = document.getElementById('viewer-progress');
  dom.viewerProgressBar = document.getElementById('viewer-progress-bar');
}
