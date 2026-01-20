// Zustand store for gallery state management

import { create } from 'zustand';
import type { Photo, Album, SiteInfo, SortMode, SortDirection } from '../types';
import { getDefaultSort, getDefaultSortDirection } from '../config';

// Re-export sort types for convenience
export type { SortMode, SortDirection } from '../types';

// localStorage key for sort preferences
const SORT_STORAGE_KEY = 'galerie-sort';

// Valid sort modes for validation
const VALID_SORT_MODES: SortMode[] = ['shuffle', 'date', 'rating', 'photographer', 'name'];

// Load sort preferences from localStorage, falling back to theme config
function loadSortPrefs(): { mode: SortMode; direction: SortDirection } {
  try {
    const stored = localStorage.getItem(SORT_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      const mode = VALID_SORT_MODES.includes(parsed.mode)
        ? parsed.mode
        : getDefaultSort();
      const direction = parsed.direction === 'asc' ? 'asc' : 'desc';
      return { mode, direction };
    }
  } catch {
    // Ignore parse errors
  }
  // Fall back to theme config defaults
  return { mode: getDefaultSort(), direction: getDefaultSortDirection() };
}

// Save sort preferences to localStorage
function saveSortPrefs(mode: SortMode, direction: SortDirection): void {
  try {
    localStorage.setItem(SORT_STORAGE_KEY, JSON.stringify({ mode, direction }));
  } catch {
    // Ignore storage errors
  }
}

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

  // Filmstrip state
  filmstripStart: number;
  filmstripEnd: number;
  filmstripCollapsed: boolean;

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
  toggleFilmstrip: () => void;

  // Sort actions
  setSortMode: (mode: SortMode) => void;
  toggleSortDirection: () => void;
}

export type GalleryStore = GalleryState & GalleryActions;

const NAVIGATION_DEBOUNCE = 100;
const GRID_BATCH_SIZE = 40;

// Load saved sort preferences
const initialSortPrefs = loadSortPrefs();

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
  filmstripCollapsed: false,
  lastNavigationTime: 0,
  sortMode: initialSortPrefs.mode,
  sortDirection: initialSortPrefs.direction,

  // Data loading
  setGalleryData: (photos, albums, site) => set({ photos, albums, site }),

  // Grid actions
  setFilterAlbum: (slug) => {
    const { filterAlbum } = get();
    if (filterAlbum === slug) return; // Prevent unnecessary updates
    set({ filterAlbum: slug, gridLoadedCount: 0 });
  },

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

    if (currentPhotoIndex < 0) return false;

    // Sort by capture date (oldest first) to match filmstrip order
    const sortedPhotos = [...photos].sort((a, b) => {
      const dateA = a.metadata.dateTaken || '';
      const dateB = b.metadata.dateTaken || '';
      return dateA.localeCompare(dateB);
    });

    // Find current photo's position in sorted order
    const currentPhoto = photos[currentPhotoIndex];
    const sortedIndex = sortedPhotos.findIndex((p) => p.stem === currentPhoto.stem);
    if (sortedIndex < 0) return false;

    // Navigate in sorted order
    const newSortedIndex = sortedIndex + direction;
    if (newSortedIndex < 0 || newSortedIndex >= sortedPhotos.length) {
      return false;
    }

    // Find the target photo's index in the main array
    const targetPhoto = sortedPhotos[newSortedIndex];
    const newIndex = photos.findIndex((p) => p.stem === targetPhoto.stem);
    if (newIndex < 0) return false;

    window.location.hash = '/photo/' + encodeURIComponent(targetPhoto.stem);

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
  toggleFilmstrip: () => set((state) => ({ filmstripCollapsed: !state.filmstripCollapsed })),

  // Sort actions
  setSortMode: (mode) => {
    const { sortDirection } = get();
    saveSortPrefs(mode, sortDirection);
    set({ sortMode: mode, gridLoadedCount: 0 });
  },
  toggleSortDirection: () => {
    const { sortMode, sortDirection } = get();
    const newDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    saveSortPrefs(sortMode, newDirection);
    set({ sortDirection: newDirection, gridLoadedCount: 0 });
  },
}));

// Memoized cache for filtered photos
let filteredPhotosCache: { filterAlbum: string | null; photos: Photo[]; result: Photo[] } | null = null;

// Selector for filtered photos based on album (memoized to prevent new array on every call)
export function useFilteredPhotos(): Photo[] {
  return useGalleryStore((state) => {
    if (!state.filterAlbum) return state.photos;

    // Return cached result if inputs haven't changed
    if (
      filteredPhotosCache &&
      filteredPhotosCache.filterAlbum === state.filterAlbum &&
      filteredPhotosCache.photos === state.photos
    ) {
      return filteredPhotosCache.result;
    }

    // Compute and cache new result
    const result = state.photos.filter((photo) =>
      photo.htmlPath.startsWith(state.filterAlbum + '/')
    );
    filteredPhotosCache = { filterAlbum: state.filterAlbum, photos: state.photos, result };
    return result;
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
