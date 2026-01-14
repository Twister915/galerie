// Filmstrip collapse/expand toggle button

import { useGalleryStore } from '../../store/galleryStore';

export function FilmstripToggle() {
  const filmstripCollapsed = useGalleryStore((s) => s.filmstripCollapsed);
  const toggleFilmstrip = useGalleryStore((s) => s.toggleFilmstrip);

  const classes = ['filmstrip-toggle', filmstripCollapsed && 'collapsed']
    .filter(Boolean)
    .join(' ');

  return (
    <button
      class={classes}
      onClick={toggleFilmstrip}
      aria-label={filmstripCollapsed ? 'Show filmstrip' : 'Hide filmstrip'}
      aria-expanded={!filmstripCollapsed}
    >
      <svg viewBox="0 0 24 24" width="21" height="13" aria-hidden="true">
        {filmstripCollapsed ? (
          <polyline
            points="18 15 12 9 6 15"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        ) : (
          <polyline
            points="6 9 12 15 18 9"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        )}
      </svg>
    </button>
  );
}
