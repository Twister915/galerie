// Language picker dropdown

import { useState, useRef, useEffect, useCallback } from 'preact/hooks';
import { useLang } from '../../context/I18nContext';

export function LangPicker() {
  const [lang, setLang] = useLang();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Get languages from global config (injected by template)
  const languages = I18N_CONFIG.languages;
  const currentLangName =
    languages.find((l) => l.code === lang)?.name || lang.toUpperCase();

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

  const handleToggle = useCallback((e: MouseEvent) => {
    e.stopPropagation();
    setOpen((prev) => !prev);
  }, []);

  const handleSelect = useCallback(
    (code: string) => {
      setLang(code);
      setOpen(false);
    },
    [setLang]
  );

  return (
    <div
      ref={containerRef}
      class={`lang-dropdown${open ? ' open' : ''}`}
      id="lang-dropdown"
    >
      <button
        ref={triggerRef}
        class="lang-dropdown-trigger"
        id="lang-dropdown-trigger"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={handleToggle}
      >
        <span class="lang-current" id="lang-current">
          {currentLangName}
        </span>
        <svg
          class="lang-dropdown-arrow"
          width="10"
          height="6"
          viewBox="0 0 10 6"
          fill="none"
        >
          <path
            d="M1 1L5 5L9 1"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </button>
      <div class="lang-dropdown-menu" id="lang-dropdown-menu" role="menu">
        {languages.map((l) => (
          <button
            key={l.code}
            class={`lang-dropdown-item${l.code === lang ? ' active' : ''}`}
            data-lang={l.code}
            role="menuitem"
            onClick={() => handleSelect(l.code)}
          >
            {l.name}
          </button>
        ))}
      </div>
    </div>
  );
}
