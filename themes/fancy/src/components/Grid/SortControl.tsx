// Sort control dropdown for grid view

import { useState, useRef, useEffect, useCallback } from 'preact/hooks';
import { useGalleryStore, type SortMode } from '../../store/galleryStore';
import { useTranslation } from '../../context/I18nContext';

const SORT_OPTIONS: { mode: SortMode; icon: string; labelKey: string }[] = [
  { mode: 'shuffle', icon: '⤮', labelKey: 'sort.shuffle' },
  { mode: 'date', icon: '◷', labelKey: 'sort.date' },
  { mode: 'rating', icon: '★', labelKey: 'sort.rating' },
  { mode: 'photographer', icon: '◐', labelKey: 'sort.photographer' },
  { mode: 'name', icon: 'Az', labelKey: 'sort.name' },
];

export function SortControl() {
  const t = useTranslation();
  const sortMode = useGalleryStore((s) => s.sortMode);
  const sortDirection = useGalleryStore((s) => s.sortDirection);
  const setSortMode = useGalleryStore((s) => s.setSortMode);
  const toggleSortDirection = useGalleryStore((s) => s.toggleSortDirection);

  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Show expanded state on hover or when open
  const expanded = open || hovered;

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

  const handleOptionClick = useCallback(
    (mode: SortMode) => {
      if (mode === sortMode) {
        // Already on this mode
        if (mode !== 'shuffle') {
          // Second click toggles direction (shuffle has no direction)
          toggleSortDirection();
        }
        // For shuffle, do nothing - already shuffled
      } else {
        setSortMode(mode);
      }
      // Keep menu open so user can double-click to toggle direction
    },
    [sortMode, setSortMode, toggleSortDirection]
  );

  const currentOption = SORT_OPTIONS.find((o) => o.mode === sortMode);
  const directionArrow =
    sortMode === 'shuffle' ? '' : sortDirection === 'asc' ? '↑' : '↓';

  return (
    <div
      ref={containerRef}
      class={`sort-control${open ? ' open' : ''}${expanded ? ' expanded' : ''}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        ref={triggerRef}
        class="sort-control-trigger"
        onClick={handleToggle}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={t('sort.label')}
      >
        <span class="sort-icon">{currentOption?.icon}</span>
        <span class="sort-label">{t('sort.label')}</span>
        {directionArrow && <span class="sort-direction">{directionArrow}</span>}
      </button>
      <div class="sort-control-menu" role="menu">
        {SORT_OPTIONS.map((option) => (
          <button
            key={option.mode}
            class={`sort-control-item${option.mode === sortMode ? ' active' : ''}`}
            role="menuitem"
            onClick={() => handleOptionClick(option.mode)}
          >
            <span class="sort-item-icon">{option.icon}</span>
            <span class="sort-item-label">{t(option.labelKey)}</span>
            {option.mode === sortMode && option.mode !== 'shuffle' && (
              <span class="sort-item-direction">{directionArrow}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
