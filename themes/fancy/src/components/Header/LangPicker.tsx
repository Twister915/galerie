// Language picker dropdown

import { useState, useEffect, useCallback } from 'preact/hooks';
import { useLang, useI18nLoading } from '../../context/I18nContext';
import { useDropdown } from '../../hooks';
import { Button, ChevronDownIcon } from '../UI';

export function LangPicker() {
  const [lang, setLang] = useLang();
  const loading = useI18nLoading();
  const [pendingLang, setPendingLang] = useState<string | null>(null);

  const { open, containerRef, triggerRef, handleTriggerClick, close } =
    useDropdown({ id: 'lang-picker' });

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

  const handleSelect = useCallback(
    (code: string) => {
      setPendingLang(code);
      setLang(code);
      close();
    },
    [setLang, close]
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
        onClick={handleTriggerClick}
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
