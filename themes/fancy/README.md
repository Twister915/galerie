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
- Dark theme optimized for photo viewing

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
