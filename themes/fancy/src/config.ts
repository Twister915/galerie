// Configuration constants
import type { SortMode, SortDirection } from './types';

// Fixed constants (not configurable)
export const GRID_BATCH_SIZE = 40;
export const FILMSTRIP_BUFFER = 10;
export const FILMSTRIP_THUMB_WIDTH = 68;
export const SWIPE_THRESHOLD = 50;
export const SWIPE_TIME_LIMIT = 300;
export const CONTROLS_HIDE_DELAY = 2000;
export const NAVIGATION_DEBOUNCE = 100;

// Theme-configurable values with fallback defaults

/**
 * Get a theme config value with a fallback default.
 * Reads from THEME_CONFIG global injected by the template.
 */
function getConfig<T>(key: string, fallback: T): T {
  if (typeof THEME_CONFIG !== 'undefined' && key in THEME_CONFIG) {
    return THEME_CONFIG[key] as T;
  }
  return fallback;
}

/** Milliseconds between slideshow transitions */
export function getSlideshowDelay(): number {
  return getConfig('slideshow_delay', 5000);
}

/** Default sort mode for the grid */
export function getDefaultSort(): SortMode {
  return getConfig('default_sort', 'shuffle');
}

/** Default sort direction (ignored for shuffle mode) */
export function getDefaultSortDirection(): SortDirection {
  return getConfig('default_sort_direction', 'desc');
}
