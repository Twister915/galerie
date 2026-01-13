// Data loading and caching

import type { GalleryData } from '../types';

type Translations = Record<string, string>;

export const i18nData: Record<string, Translations> = {};
export let galleryData: GalleryData | null = null;

const GALLERY_CACHE_KEY = 'galerie-gallery-' + GALLERY_URL;

function getI18nCacheKey(lang: string): string {
  return 'galerie-i18n-' + I18N_URLS[lang];
}

export function loadI18nLang(lang: string): Promise<void> {
  const url = I18N_URLS[lang];
  if (!url) {
    return Promise.resolve();
  }

  const cacheKey = getI18nCacheKey(lang);
  let cached: string | null = null;

  try {
    cached = localStorage.getItem(cacheKey);
  } catch {
    // localStorage not available
  }

  if (cached) {
    try {
      i18nData[lang] = JSON.parse(cached);
      return Promise.resolve();
    } catch {
      cached = null;
    }
  }

  return fetch(url)
    .then((r) => r.json())
    .then((data: Translations) => {
      i18nData[lang] = data;
      try {
        localStorage.setItem(cacheKey, JSON.stringify(data));
      } catch {
        // localStorage full or not available
      }
    });
}

export function loadData(): Promise<void[]> {
  const promises: Promise<void>[] = [];

  // Load i18n for current language and default language
  const currentLang = localStorage.getItem('lang') || detectLangFromBrowser();
  promises.push(loadI18nLang(currentLang));

  // Also load default language as fallback (if different)
  if (currentLang !== I18N_CONFIG.default) {
    promises.push(loadI18nLang(I18N_CONFIG.default));
  }

  // Load gallery
  let galleryCached: string | null = null;
  try {
    galleryCached = localStorage.getItem(GALLERY_CACHE_KEY);
  } catch {
    // localStorage not available
  }

  if (galleryCached) {
    try {
      galleryData = JSON.parse(galleryCached);
    } catch {
      galleryCached = null;
    }
  }

  if (!galleryCached) {
    promises.push(
      fetch(GALLERY_URL)
        .then((r) => r.json())
        .then((data: GalleryData) => {
          galleryData = data;
          try {
            localStorage.setItem(GALLERY_CACHE_KEY, JSON.stringify(data));
          } catch {
            // localStorage full or not available
          }
        })
    );
  }

  return Promise.all(promises);
}

function detectLangFromBrowser(): string {
  const langs = navigator.languages || [navigator.language];
  for (const browserLang of langs) {
    const normalized = browserLang.replace('-', '_');
    if (I18N_URLS[normalized]) return normalized;
    const prefix = browserLang.split('-')[0];
    for (const lang in I18N_URLS) {
      if (lang.indexOf(prefix) === 0) return lang;
    }
  }
  return I18N_CONFIG.default;
}

export { detectLangFromBrowser };
