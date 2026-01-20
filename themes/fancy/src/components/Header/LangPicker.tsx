// Language picker dropdown

import { useState, useRef, useEffect, useCallback } from 'preact/hooks';
import { useLang, useI18nLoading } from '../../context/I18nContext';
import { Button, ChevronDownIcon } from '../UI';

export function LangPicker() {
  const [lang, setLang] = useLang();
  const loading = useI18nLoading();
  const [open, setOpen] = useState(false);
  const [pendingLang, setPendingLang] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Clear pending state when loading completes
  useEffect(() => {
    if (!loading) {
      setPendingLang(null);
    }
  }, [loading]);

  // Get languages from global config (injected by template)
  const languages = I18N_CONFIG.languages;
  // Show pending language while loading, otherwise show current
  const displayLang = pendingLang || lang;
  const currentLangName =
    languages.find((l) => l.code === displayLang)?.name || displayLang.toUpperCase();

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Close on Escape
  useEffect(() => {
    function handleKeydown(e: KeyboardEvent) {
      if (e.key === 'Escape' && open) {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener('keydown', handleKeydown);
    return () => document.removeEventListener('keydown', handleKeydown);
  }, [open]);

  // Close on scroll (for mobile)
  useEffect(() => {
    function handleScroll() {
      if (open) setOpen(false);
    }

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [open]);

  const handleToggle = useCallback((e: MouseEvent) => {
    e.stopPropagation();
    setOpen((prev) => !prev);
  }, []);

  const handleSelect = useCallback(
    (code: string) => {
      setPendingLang(code);
      setLang(code);
      setOpen(false);
    },
    [setLang]
  );

  const isLoading = pendingLang !== null;

  return (
    <div
      ref={containerRef}
      class={`lang-dropdown${open ? ' open' : ''}${isLoading ? ' loading' : ''}`}
      id="lang-dropdown"
    >
      <Button
        ref={triggerRef}
        open={open}
        class="lang-dropdown-trigger"
        id="lang-dropdown-trigger"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={handleToggle}
        disabled={isLoading}
      >
        <span class="lang-current" id="lang-current">
          {currentLangName}
        </span>
        {isLoading ? (
          <span class="lang-dropdown-spinner" />
        ) : (
          <ChevronDownIcon class="btn__arrow" />
        )}
      </Button>
      <div class="lang-dropdown-menu" id="lang-dropdown-menu" role="menu">
        {languages.map((l) => (
          <Button
            key={l.code}
            variant="menu-item"
            active={l.code === lang}
            class="lang-dropdown-item"
            data-lang={l.code}
            role="menuitem"
            onClick={() => handleSelect(l.code)}
          >
            {l.name}
          </Button>
        ))}
      </div>
    </div>
  );
}
