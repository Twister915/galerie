// Theme management hook for light/dark mode switching

import { useState, useEffect, useCallback } from 'preact/hooks';
import { getDefaultTheme } from '../config';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'galerie-theme';
const TRANSITION_DURATION = 400;

function getSystemTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function getConfiguredDefault(): Theme {
  const defaultTheme = getDefaultTheme();
  if (defaultTheme === 'system') {
    return getSystemTheme();
  }
  return defaultTheme;
}

function getStoredTheme(): Theme | null {
  if (typeof localStorage === 'undefined') return null;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  return null;
}

function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme);
}

export function useTheme(): [Theme, () => void, boolean] {
  const defaultThemeSetting = getDefaultTheme();

  // hasManualPreference indicates if user has explicitly chosen a theme
  const [manualTheme, setManualTheme] = useState<Theme | null>(getStoredTheme);
  const [configuredDefault, setConfiguredDefault] = useState<Theme>(getConfiguredDefault);

  // Effective theme: manual override or configured default
  const effectiveTheme = manualTheme ?? configuredDefault;
  const hasManualPreference = manualTheme !== null;

  // Apply theme to DOM on mount and when it changes
  useEffect(() => {
    applyTheme(effectiveTheme);
  }, [effectiveTheme]);

  // Listen for system theme changes (only when default_theme is "system")
  useEffect(() => {
    if (defaultThemeSetting !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: light)');

    function handleChange(e: MediaQueryListEvent) {
      setConfiguredDefault(e.matches ? 'light' : 'dark');
    }

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [defaultThemeSetting]);

  // Toggle between themes (sets manual preference)
  const toggleTheme = useCallback(() => {
    const newTheme = effectiveTheme === 'dark' ? 'light' : 'dark';
    const root = document.documentElement;

    // Add transition class first
    root.classList.add('theme-transitioning');

    // Use double requestAnimationFrame to ensure the browser has painted
    // with the transition class before we change the theme
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        // Now change the theme - the transition will animate
        setManualTheme(newTheme);
        localStorage.setItem(STORAGE_KEY, newTheme);

        // Remove transition class after animation completes
        setTimeout(() => {
          root.classList.remove('theme-transitioning');
        }, TRANSITION_DURATION);
      });
    });
  }, [effectiveTheme]);

  return [effectiveTheme, toggleTheme, hasManualPreference];
}
