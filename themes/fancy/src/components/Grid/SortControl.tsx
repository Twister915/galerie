// Sort control dropdown for grid view

import { useState, useCallback } from 'preact/hooks';
import { useGalleryStore, type SortMode } from '../../store/galleryStore';
import { useTranslation } from '../../context/I18nContext';
import { useDropdown } from '../../hooks';
import { Button } from '../UI';

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

  const [hovered, setHovered] = useState(false);

  const { open, containerRef, triggerRef, handleTriggerClick } = useDropdown({
    id: 'sort-control',
    onScroll: () => setHovered(false),
  });

  // Show expanded state on hover or when open
  const expanded = open || hovered;

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
      <Button
        ref={triggerRef}
        size="lg"
        variant="filled"
        open={open}
        class="sort-control-trigger"
        onClick={handleTriggerClick}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={t('sort.label')}
      >
        <span class="sort-icon">{currentOption?.icon}</span>
        <span class="sort-label">{t('sort.label')}</span>
        {directionArrow && <span class="sort-direction">{directionArrow}</span>}
      </Button>
      <div class="sort-control-menu" role="menu">
        {SORT_OPTIONS.map((option) => (
          <Button
            key={option.mode}
            variant="menu-item"
            size="lg"
            active={option.mode === sortMode}
            class="sort-control-item"
            role="menuitem"
            onClick={() => handleOptionClick(option.mode)}
          >
            <span class="sort-item-icon">{option.icon}</span>
            <span class="sort-item-label">{t(option.labelKey)}</span>
            {option.mode === sortMode && option.mode !== 'shuffle' && (
              <span class="sort-item-direction">{directionArrow}</span>
            )}
          </Button>
        ))}
      </div>
    </div>
  );
}
