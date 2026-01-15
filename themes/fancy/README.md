# Fancy Theme

A modern, interactive photo gallery theme for [galerie](../../README.md). Built with Preact and Zustand for a lightweight but feature-rich experience.

## Tech Stack

| Library | Version | Purpose |
|---------|---------|---------|
| [Preact](https://preactjs.com/) | 10.x | Fast 3kB React alternative |
| [Zustand](https://zustand-demo.pmnd.rs/) | 5.x | Lightweight state management |
| [Vite](https://vitejs.dev/) | 5.x | Build tool and dev server |
| [TypeScript](https://www.typescriptlang.org/) | 5.x | Type safety |
| [Sass](https://sass-lang.com/) | 1.x | CSS preprocessing |
| [Masonry](https://masonry.desandro.com/) | 4.x | Grid layout (CDN) |
| [Leaflet](https://leafletjs.com/) | 1.x | Interactive maps (CDN) |

## Features

- Responsive masonry grid with infinite scroll
- Lightbox viewer with keyboard/touch navigation
- Big picture mode with crossfade slideshow
- Photo metadata drawer (EXIF, GPS, ratings)
- Interactive map for geotagged photos
- Multi-language support (20 languages)
- Sorting by date, rating, name, photographer
- Light/dark mode with system preference detection

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              Browser                                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────┐    ┌──────────────────────────────────────────────┐   │
│  │ I18nContext │    │              Zustand Store                    │   │
│  │             │    │  ┌─────────┐ ┌─────────┐ ┌────────────────┐  │   │
│  │ • lang      │    │  │ photos  │ │ viewer  │ │ grid           │  │   │
│  │ • t()       │    │  │ albums  │ │ state   │ │ state          │  │   │
│  │ • formatDate│    │  │ site    │ │         │ │                │  │   │
│  └──────┬──────┘    │  └─────────┘ └─────────┘ └────────────────┘  │   │
│         │           └──────────────────┬───────────────────────────┘   │
│         │                              │                                │
│         └──────────────┬───────────────┘                                │
│                        ▼                                                │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                         App Component                            │   │
│  │  ┌──────────────────────────────────────────────────────────┐   │   │
│  │  │                        Header                             │   │   │
│  │  │  ┌─────────┐  ┌───────────┐  ┌────────────────────────┐  │   │   │
│  │  │  │ Title   │  │ Album Nav │  │ LangPicker/SortControl │  │   │   │
│  │  │  └─────────┘  └───────────┘  └────────────────────────┘  │   │   │
│  │  └──────────────────────────────────────────────────────────┘   │   │
│  │  ┌──────────────────────────────────────────────────────────┐   │   │
│  │  │                         Grid                              │   │   │
│  │  │  ┌───────────┐ ┌───────────┐ ┌───────────┐               │   │   │
│  │  │  │ PhotoTile │ │ PhotoTile │ │ PhotoTile │ ...           │   │   │
│  │  │  └───────────┘ └───────────┘ └───────────┘               │   │   │
│  │  │                    ▲ Masonry Layout                       │   │   │
│  │  └──────────────────────────────────────────────────────────┘   │   │
│  │  ┌──────────────────────────────────────────────────────────┐   │   │
│  │  │                        Viewer                             │   │   │
│  │  │  ┌────────────────┐  ┌─────────────┐  ┌──────────────┐   │   │   │
│  │  │  │ ViewerControls │  │ ViewerImage │  │    Drawer    │   │   │   │
│  │  │  └────────────────┘  └─────────────┘  │  ┌────────┐  │   │   │   │
│  │  │  ┌────────────────────────────────┐   │  │ Meta   │  │   │   │   │
│  │  │  │           Filmstrip            │   │  │ Map    │  │   │   │   │
│  │  │  │  ┌─────┐ ┌─────┐ ┌─────┐      │   │  │ Download│  │   │   │   │
│  │  │  │  │Thumb│ │Thumb│ │Thumb│ ...  │   │  └────────┘  │   │   │   │
│  │  │  │  └─────┘ └─────┘ └─────┘      │   └──────────────┘   │   │   │
│  │  │  └────────────────────────────────┘                      │   │   │
│  │  └──────────────────────────────────────────────────────────┘   │   │
│  │  ┌──────────────────────────────────────────────────────────┐   │   │
│  │  │                        Footer                             │   │   │
│  │  └──────────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Project Structure

```
themes/fancy/
├── src/
│   ├── main.tsx                 # Entry point
│   ├── types.ts                 # TypeScript definitions
│   ├── config.ts                # App configuration
│   ├── components/
│   │   ├── App/                 # Root component
│   │   ├── Header/              # Site header, nav, language picker
│   │   ├── Grid/                # Masonry grid, photo tiles, sort control
│   │   ├── Viewer/              # Lightbox viewer, image display
│   │   ├── ViewerControls/      # Slideshow, fullscreen, info buttons
│   │   ├── Filmstrip/           # Thumbnail strip (virtualized)
│   │   ├── Drawer/              # Metadata panel, download link
│   │   ├── Map/                 # Leaflet map for GPS data
│   │   └── Footer/              # Site footer
│   ├── context/
│   │   └── I18nContext.tsx      # Internationalization provider
│   ├── store/
│   │   └── galleryStore.ts      # Zustand state management
│   ├── hooks/
│   │   ├── useHashRouter.ts     # Hash-based routing
│   │   ├── useImageLoader.ts    # Progressive image loading
│   │   ├── useIntersectionObserver.ts  # Infinite scroll
│   │   ├── useKeyboardNav.ts    # Keyboard shortcuts
│   │   ├── useMasonry.ts        # Masonry grid integration
│   │   └── useTouchSwipe.ts     # Touch gestures
│   └── utils/
│       ├── format.ts            # Formatting helpers
│       └── hash.ts              # Hash utilities
├── styles/
│   ├── main.scss                # Entry point
│   ├── _variables.scss          # CSS custom properties
│   ├── _base.scss               # Reset and base styles
│   ├── _header.scss             # Header styles
│   ├── _grid.scss               # Masonry grid
│   ├── _viewer.scss             # Lightbox
│   ├── _bigPicture.scss         # Fullscreen/slideshow mode
│   ├── _filmstrip.scss          # Thumbnail strip
│   ├── _drawer.scss             # Info drawer
│   ├── _footer.scss             # Footer
│   ├── _sortControl.scss        # Sort dropdown
│   ├── _responsive.scss         # Media queries
│   └── _utilities.scss          # Helper classes
├── public/                      # Static assets
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## State Management

The app uses [Zustand](https://zustand-demo.pmnd.rs/) for centralized state:

```typescript
interface GalleryState {
  // Data from galerie
  photos: Photo[];
  albums: Album[];
  site: SiteInfo;

  // Grid state
  filterAlbum: string | null;
  gridLoadedCount: number;
  sortMode: 'shuffle' | 'date' | 'rating' | 'photographer' | 'name';
  sortDirection: 'asc' | 'desc';

  // Viewer state
  currentPhotoIndex: number;
  drawerOpen: boolean;
  bigPictureMode: boolean;
  slideshowPlaying: boolean;
}
```

## Configuration

The fancy theme supports configuration options via `site.toml`. Add a `[theme]` section to customize behavior:

```toml
[theme]
name = "fancy"
slideshow_delay = 8000       # Milliseconds between slides (default: 5000)
default_sort = "date"        # Initial sort: shuffle, date, rating, photographer, name
default_sort_direction = "desc"  # Sort direction: asc or desc
default_theme = "dark"       # Color theme: system, dark, or light
```

### Available Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `slideshow_delay` | number | 5000 | Milliseconds between slideshow transitions |
| `default_sort` | string | "shuffle" | Initial sort mode for the photo grid |
| `default_sort_direction` | string | "desc" | Sort direction (ignored for shuffle mode) |
| `default_theme` | string | "system" | Color theme: `system`, `dark`, or `light` |

### Theme Behavior

| Value | Description |
|-------|-------------|
| `system` | Follows the user's OS light/dark preference (default) |
| `dark` | Always starts in dark mode, ignores system preference |
| `light` | Always starts in light mode, ignores system preference |

Users can toggle between light and dark mode using the button in the header. The photo viewer (overlay, filmstrip, controls) always uses dark mode for optimal photo viewing regardless of theme setting.

### Sort Direction Behavior

| Sort Mode | `asc` | `desc` |
|-----------|-------|--------|
| `date` | Oldest first | Newest first |
| `rating` | Lowest rated first | Highest rated first |
| `name` | A → Z | Z → A |
| `photographer` | A → Z by copyright | Z → A by copyright |
| `shuffle` | (ignored) | (ignored) |

User preferences saved in localStorage take precedence over theme defaults.

## Build Commands

```bash
# Development with hot reload
npm run dev

# Production build (outputs to dist/)
npm run build

# Preview production build
npm run preview
```

## Integration with galerie

The theme is compiled and embedded into the galerie binary at build time. The Rust backend:

1. Renders Tera templates with gallery data
2. Injects `GALLERY_DATA` JSON into the HTML
3. Serves the compiled JS/CSS from `dist/`

The frontend hydrates from the injected data and takes over rendering.
