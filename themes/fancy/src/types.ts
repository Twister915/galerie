// Type definitions for the gallery application

export interface Photo {
  stem: string;
  hash: string;
  width: number;
  height: number;
  originalSize: number;
  imagePath: string;
  thumbPath: string;
  microThumbPath: string;
  originalPath: string;
  htmlPath: string;
  metadata: PhotoMetadata;
}

export interface PhotoMetadata {
  dateTaken?: string;
  camera?: string;
  lens?: string;
  copyright?: string;
  gps?: GpsData;
  exposure?: ExposureData;
  rating?: number;
}

export interface GpsData {
  latitude: number | null;
  longitude: number | null;
  display: string | null;
  city?: string;
  region?: string;
  country?: string;
  countryCode?: string;
  flag?: string;
}

export interface ExposureData {
  aperture?: string;
  shutterSpeed?: string;
  iso?: number;
  focalLength?: string;
  program?: string;
}

export interface Album {
  name: string;
  slug: string;
  path: string;
}

export interface SiteInfo {
  domain: string;
  title: string;
  version: string;
}

export interface GalleryData {
  site: SiteInfo;
  albums: Album[];
  photos: Photo[];
}

export interface TouchState {
  startX: number;
  startY: number;
  startTime: number;
}

export interface DomElements {
  header: HTMLElement | null;
  gallery: HTMLElement | null;
  grid: HTMLElement | null;
  viewer: HTMLElement | null;
  viewerBackdrop: HTMLElement | null;
  viewerImage: HTMLImageElement | null;
  viewerImageNext: HTMLImageElement | null;
  viewerImageContainer: HTMLElement | null;
  viewerClose: HTMLButtonElement | null;
  viewerPrev: HTMLButtonElement | null;
  viewerNext: HTMLButtonElement | null;
  infoDrawer: HTMLElement | null;
  drawerToggle: HTMLButtonElement | null;
  drawerContent: HTMLElement | null;
  filmstrip: HTMLElement | null;
  filmstripTrack: HTMLElement | null;
  loadingSentinel: HTMLElement | null;
  bigPictureToggle: HTMLButtonElement | null;
  slideshowToggle: HTMLButtonElement | null;
  viewerProgress: HTMLElement | null;
  viewerProgressBar: HTMLElement | null;
}

export interface ImageDownload {
  promise: Promise<string>;
  abort: () => void;
}

// Language info from template
export interface LanguageInfo {
  code: string;
  name: string;
}

// Declare global variables injected by template
declare global {
  const GALLERY_URL: string;
  const I18N_URLS: Record<string, string>;
  const I18N_CONFIG: { default: string; languages: LanguageInfo[] };

  // External libraries
  interface Window {
    Masonry: new (
      element: HTMLElement,
      options: MasonryOptions
    ) => MasonryInstance;
    imagesLoaded: (elements: HTMLElement[], callback: () => void) => void;
    L: typeof L;
  }
}

// Re-export Leaflet namespace for use in other modules
import type * as L from 'leaflet';
export type { L };

export interface MasonryOptions {
  itemSelector: string;
  columnWidth: string;
  gutter: string;
  fitWidth: boolean;
  transitionDuration: number;
  initLayout: boolean;
}

export interface MasonryInstance {
  layout: () => void;
  appended: (elements: HTMLElement[]) => void;
}
