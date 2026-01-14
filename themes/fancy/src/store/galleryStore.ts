// Zustand store for gallery state management

import { create } from 'zustand';
import type { Photo, Album, SiteInfo } from '../types';

// Sort types
export type SortMode = 'shuffle' | 'date' | 'rating' | 'photographer' | 'name';
export type SortDirection = 'asc' | 'desc';

interface GalleryState {
  // Data
  photos: Photo[];
  albums: Album[];
  site: SiteInfo;

  // Grid state
  filterAlbum: string | null;
  gridLoadedCount: number;
  gridLoading: boolean;

  // Viewer state
  currentPhotoIndex: number;
  drawerOpen: boolean;
  bigPictureMode: boolean;
  slideshowPlaying: boolean;

  // Filmstrip virtualization
  filmstripStart: number;
  filmstripEnd: number;

  // Navigation tracking (for debouncing)
  lastNavigationTime: number;

  // Sort state
  sortMode: SortMode;
  sortDirection: SortDirection;
}

interface GalleryActions {
  // Data loading
  setGalleryData: (photos: Photo[], albums: Album[], site: SiteInfo) => void;

  // Grid actions
  setFilterAlbum: (slug: string | null) => void;
  loadMoreGrid: (count: number) => void;
  setGridLoading: (loading: boolean) => void;
  resetGrid: () => void;

  // Viewer actions
  openViewer: (index: number) => void;
  closeViewer: () => void;
  navigatePhoto: (direction: number) => boolean;
  setCurrentPhotoIndex: (index: number) => void;

  // Drawer actions
  toggleDrawer: () => void;
  setDrawerOpen: (open: boolean) => void;

  // Mode actions
  setBigPictureMode: (enabled: boolean) => void;
  toggleBigPictureMode: () => void;
  setSlideshowPlaying: (playing: boolean) => void;
  toggleSlideshow: () => void;

  // Filmstrip actions
  setFilmstripRange: (start: number, end: number) => void;

  // Sort actions
  setSortMode: (mode: SortMode) => void;
  toggleSortDirection: () => void;
}

export type GalleryStore = GalleryState & GalleryActions;

const NAVIGATION_DEBOUNCE = 100;
const GRID_BATCH_SIZE = 40;

export const useGalleryStore = create<GalleryStore>((set, get) => ({
  // Initial state
  photos: [],
  albums: [],
  site: { domain: '', title: '', version: '' },
  filterAlbum: null,
  gridLoadedCount: 0,
  gridLoading: false,
  currentPhotoIndex: -1,
  drawerOpen: false,
  bigPictureMode: false,
  slideshowPlaying: false,
  filmstripStart: 0,
  filmstripEnd: 0,
  lastNavigationTime: 0,
  sortMode: 'shuffle',
  sortDirection: 'desc',

  // Data loading
  setGalleryData: (photos, albums, site) => set({ photos, albums, site }),

  // Grid actions
  setFilterAlbum: (slug) => set({ filterAlbum: slug, gridLoadedCount: 0 }),

  loadMoreGrid: (count = GRID_BATCH_SIZE) =>
    set((state) => ({
      gridLoadedCount: Math.min(
        state.gridLoadedCount + count,
        state.photos.length
      ),
    })),

  setGridLoading: (loading) => set({ gridLoading: loading }),

  resetGrid: () => set({ gridLoadedCount: 0, gridLoading: false }),

  // Viewer actions
  openViewer: (index) => {
    const { photos } = get();
    if (index < 0 || index >= photos.length) return;

    const photo = photos[index];
    window.location.hash = '/photo/' + encodeURIComponent(photo.stem);
    document.body.classList.add('viewer-open');

    set({ currentPhotoIndex: index });
  },

  closeViewer: () => {
    document.body.classList.remove('viewer-open');
    history.replaceState(
      null,
      '',
      window.location.pathname + window.location.search
    );

    set({
      currentPhotoIndex: -1,
      drawerOpen: false,
      bigPictureMode: false,
      slideshowPlaying: false,
    });
  },

  navigatePhoto: (direction) => {
    const { currentPhotoIndex, photos, lastNavigationTime } = get();
    const now = Date.now();

    if (now - lastNavigationTime < NAVIGATION_DEBOUNCE) {
      return false;
    }

    const newIndex = currentPhotoIndex + direction;
    if (newIndex < 0 || newIndex >= photos.length) {
      return false;
    }

    const photo = photos[newIndex];
    window.location.hash = '/photo/' + encodeURIComponent(photo.stem);

    set({
      currentPhotoIndex: newIndex,
      lastNavigationTime: now,
    });

    return true;
  },

  setCurrentPhotoIndex: (index) => set({ currentPhotoIndex: index }),

  // Drawer actions
  toggleDrawer: () => set((state) => ({ drawerOpen: !state.drawerOpen })),
  setDrawerOpen: (open) => set({ drawerOpen: open }),

  // Mode actions
  setBigPictureMode: (enabled) => set({ bigPictureMode: enabled }),
  toggleBigPictureMode: () =>
    set((state) => ({ bigPictureMode: !state.bigPictureMode })),

  setSlideshowPlaying: (playing) => set({ slideshowPlaying: playing }),
  toggleSlideshow: () =>
    set((state) => ({ slideshowPlaying: !state.slideshowPlaying })),

  // Filmstrip actions
  setFilmstripRange: (start, end) => set({ filmstripStart: start, filmstripEnd: end }),

  // Sort actions
  setSortMode: (mode) => set({ sortMode: mode, gridLoadedCount: 0 }),
  toggleSortDirection: () =>
    set((state) => ({
      sortDirection: state.sortDirection === 'asc' ? 'desc' : 'asc',
      gridLoadedCount: 0,
    })),
}));

// Selector for filtered photos based on album
export function useFilteredPhotos(): Photo[] {
  return useGalleryStore((state) => {
    if (!state.filterAlbum) return state.photos;
    return state.photos.filter((photo) =>
      photo.htmlPath.startsWith(state.filterAlbum + '/')
    );
  });
}

// Selector for current photo
export function useCurrentPhoto(): Photo | null {
  return useGalleryStore((state) =>
    state.currentPhotoIndex >= 0 ? state.photos[state.currentPhotoIndex] : null
  );
}

// Selector for viewer open state
export function useViewerOpen(): boolean {
  return useGalleryStore((state) => state.currentPhotoIndex >= 0);
}
