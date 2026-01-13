// Internationalization service

import { i18nData, loadI18nLang, detectLangFromBrowser } from './data';
import { state } from '../state';
import { updateDrawerContent } from '../components/drawer';

export function getLang(): string {
  return localStorage.getItem('lang') || detectLangFromBrowser();
}

export function setLang(lang: string): void {
  if (!i18nData[lang]) {
    document.body.classList.add('loading-lang');
    loadI18nLang(lang)
      .then(() => {
        document.body.classList.remove('loading-lang');
        applyLangChange(lang);
      })
      .catch(() => {
        document.body.classList.remove('loading-lang');
        applyLangChange(lang);
      });
  } else {
    applyLangChange(lang);
  }
}

function applyLangChange(lang: string): void {
  localStorage.setItem('lang', lang);
  document.documentElement.lang = lang;
  applyTranslations();
  if (state.currentPhotoIndex >= 0) {
    updateDrawerContent(state.photos[state.currentPhotoIndex]);
  }
  updateLangPicker();
}

export function applyTranslations(): void {
  const elements = document.querySelectorAll('[data-i18n]');
  for (const element of elements) {
    element.textContent = t(element.getAttribute('data-i18n') || '');
  }
}

export function t(key: string): string {
  const lang = getLang();
  if (i18nData[lang] && typeof i18nData[lang][key] === 'string') {
    return i18nData[lang][key];
  }
  if (
    i18nData[I18N_CONFIG.default] &&
    typeof i18nData[I18N_CONFIG.default][key] === 'string'
  ) {
    return i18nData[I18N_CONFIG.default][key];
  }
  return key;
}

export function updateLangPicker(): void {
  const current = getLang();
  const dropdown = document.getElementById('lang-dropdown');
  if (!dropdown) return;

  const currentEl = document.getElementById('lang-current');
  const items = dropdown.querySelectorAll('.lang-dropdown-item');
  for (const item of items) {
    const isActive = item.getAttribute('data-lang') === current;
    item.classList.toggle('active', isActive);
    if (isActive && currentEl) {
      currentEl.textContent = item.textContent;
    }
  }
}

export function toggleLangDropdown(): void {
  const dropdown = document.getElementById('lang-dropdown');
  const trigger = document.getElementById('lang-dropdown-trigger');
  if (!dropdown || !trigger) return;

  const isOpen = dropdown.classList.toggle('open');
  trigger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
}

export function closeLangDropdown(): void {
  const dropdown = document.getElementById('lang-dropdown');
  const trigger = document.getElementById('lang-dropdown-trigger');
  if (!dropdown || !trigger) return;

  dropdown.classList.remove('open');
  trigger.setAttribute('aria-expanded', 'false');
}

export function setupLangPicker(): void {
  document.documentElement.lang = getLang();
  applyTranslations();

  const dropdown = document.getElementById('lang-dropdown');
  const trigger = document.getElementById('lang-dropdown-trigger');
  if (!dropdown || !trigger) return;

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleLangDropdown();
  });

  const items = dropdown.querySelectorAll('.lang-dropdown-item');
  for (const item of items) {
    item.addEventListener('click', () => {
      setLang(item.getAttribute('data-lang') || '');
      closeLangDropdown();
    });
  }

  document.addEventListener('click', (e) => {
    if (!dropdown.contains(e.target as Node)) {
      closeLangDropdown();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && dropdown.classList.contains('open')) {
      closeLangDropdown();
      trigger.focus();
    }
  });

  updateLangPicker();
}
