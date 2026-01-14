// I18n context and provider

import { createContext } from 'preact';
import {
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'preact/hooks';
import type { ComponentChildren } from 'preact';

type Translations = Record<string, string>;

interface I18nContextValue {
  lang: string;
  setLang: (lang: string) => void;
  t: (key: string) => string;
  loading: boolean;
}

const I18nContext = createContext<I18nContextValue | null>(null);

// In-memory translation cache
const translationCache: Record<string, Translations> = {};

function getStoredLang(): string {
  try {
    return localStorage.getItem('lang') || detectLangFromBrowser();
  } catch {
    return detectLangFromBrowser();
  }
}

function detectLangFromBrowser(): string {
  const langs = navigator.languages || [navigator.language];
  for (const browserLang of langs) {
    const normalized = browserLang.replace('-', '_');
    if (I18N_URLS[normalized]) return normalized;
    const prefix = browserLang.split('-')[0];
    for (const lang in I18N_URLS) {
      if (lang.startsWith(prefix)) return lang;
    }
  }
  return I18N_CONFIG.default;
}

function getCacheKey(lang: string): string {
  return 'galerie-i18n-' + I18N_URLS[lang];
}

async function loadTranslations(lang: string): Promise<Translations> {
  // Check memory cache first
  if (translationCache[lang]) {
    return translationCache[lang];
  }

  const url = I18N_URLS[lang];
  if (!url) {
    return {};
  }

  // Try localStorage cache
  const cacheKey = getCacheKey(lang);
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const data = JSON.parse(cached);
      translationCache[lang] = data;
      return data;
    }
  } catch {
    // localStorage not available or invalid
  }

  // Fetch from network
  const response = await fetch(url);
  const data = await response.json();
  translationCache[lang] = data;

  // Store in localStorage
  try {
    localStorage.setItem(cacheKey, JSON.stringify(data));
  } catch {
    // localStorage full or not available
  }

  return data;
}

interface I18nProviderProps {
  children: ComponentChildren;
}

export function I18nProvider({ children }: I18nProviderProps) {
  const [lang, setLangState] = useState(getStoredLang);
  const [translations, setTranslations] = useState<Translations>({});
  const [defaultTranslations, setDefaultTranslations] = useState<Translations>(
    {}
  );
  const [loading, setLoading] = useState(true);

  // Load initial translations
  useEffect(() => {
    async function init() {
      setLoading(true);
      const [current, defaults] = await Promise.all([
        loadTranslations(lang),
        lang !== I18N_CONFIG.default
          ? loadTranslations(I18N_CONFIG.default)
          : Promise.resolve({}),
      ]);
      setTranslations(current);
      setDefaultTranslations(defaults);
      document.documentElement.lang = lang;
      setLoading(false);
    }
    init();
  }, []);

  const setLang = useCallback(async (newLang: string) => {
    setLoading(true);
    const newTranslations = await loadTranslations(newLang);
    setTranslations(newTranslations);
    setLangState(newLang);
    document.documentElement.lang = newLang;
    try {
      localStorage.setItem('lang', newLang);
    } catch {
      // localStorage not available
    }
    setLoading(false);
  }, []);

  const t = useCallback(
    (key: string): string => {
      if (typeof translations[key] === 'string') {
        return translations[key];
      }
      if (typeof defaultTranslations[key] === 'string') {
        return defaultTranslations[key];
      }
      return key;
    },
    [translations, defaultTranslations]
  );

  const value = useMemo(
    () => ({ lang, setLang, t, loading }),
    [lang, setLang, t, loading]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useTranslation(): (key: string) => string {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useTranslation must be used within I18nProvider');
  }
  return context.t;
}

export function useLang(): [string, (lang: string) => void] {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useLang must be used within I18nProvider');
  }
  return [context.lang, context.setLang];
}

export function useI18nLoading(): boolean {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18nLoading must be used within I18nProvider');
  }
  return context.loading;
}

// Convert galerie lang code to Intl-compatible locale (e.g., 'zh_cn' -> 'zh-CN')
function toIntlLocale(lang: string): string {
  const parts = lang.split('_');
  if (parts.length === 2) {
    return `${parts[0]}-${parts[1].toUpperCase()}`;
  }
  return lang;
}

// Parse EXIF date format (YYYY:MM:DD HH:MM:SS) to Date object
function parseExifDate(exifDate: string): Date | null {
  // EXIF format: "2025:02:11 11:42:37"
  const match = exifDate.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
  if (!match) return null;
  const [, year, month, day, hour, minute, second] = match;
  return new Date(
    parseInt(year),
    parseInt(month) - 1,
    parseInt(day),
    parseInt(hour),
    parseInt(minute),
    parseInt(second)
  );
}

// Format a date string for display using the given locale
function formatDateTime(exifDate: string, lang: string): string {
  const date = parseExifDate(exifDate);
  if (!date) return exifDate; // Return original if parsing fails

  const locale = toIntlLocale(lang);
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function useDateFormatter(): (exifDate: string) => string {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useDateFormatter must be used within I18nProvider');
  }
  return useCallback(
    (exifDate: string) => formatDateTime(exifDate, context.lang),
    [context.lang]
  );
}
