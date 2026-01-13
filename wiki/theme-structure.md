# Theme Structure

galerie supports two types of themes: **classic themes** (plain HTML/CSS/JS) and **Vite themes** (npm-based builds with TypeScript, SCSS, and modern frameworks).

## Classic Themes

Simple themes with static assets that don't require a build step.

### Directory Layout

```
my-theme/
├── templates/
│   ├── base.html       # Optional: common wrapper
│   ├── index.html      # Required: site homepage
│   ├── album.html      # Optional: album pages
│   └── photo.html      # Optional: photo pages
└── static/             # Optional: CSS, JS, images
    ├── style.css
    └── app.js
```

### How It Works

- Templates are processed by the Tera engine
- Static files are copied to output with content-hashed filenames
- No build step required

## Vite Themes

Modern themes using npm/Vite for builds, enabling TypeScript, SCSS, component frameworks (Preact/React), and other modern tooling.

### Directory Layout

```
my-theme/
├── package.json            # npm dependencies and scripts
├── vite.config.ts          # Vite build configuration
├── tsconfig.json           # TypeScript configuration
├── src/
│   ├── main.tsx            # Entry point
│   ├── components/         # UI components
│   ├── styles/
│   │   └── main.scss       # SCSS styles
│   └── ...
├── templates/              # Tera templates (source)
│   ├── base.html
│   └── index.html
└── dist/                   # Build output (auto-generated)
    ├── static/
    │   ├── app.js          # Bundled JavaScript
    │   └── style.css       # Compiled CSS
    └── templates/          # Copied templates
```

### Detection

A theme is detected as a Vite theme when it has both:
- `package.json`
- `vite.config.ts` (or `.js`, `.mts`, `.mjs`)

### Auto-Build

Vite themes are automatically built when needed. The build process:

1. **Detects package manager** - Uses bun, pnpm, yarn, or npm based on lockfile presence
2. **Installs dependencies** - Runs `npm install` if `node_modules/` doesn't exist
3. **Cleans dist/** - Removes stale files from previous builds
4. **Runs build** - Executes `npm run build`

**When does this happen?**

- **Built-in themes** (in galerie's `themes/` directory): Built during `cargo build` and embedded into the binary
- **Custom themes** (in your site directory): Built when you run `galerie build` or `galerie serve`

For custom themes, galerie automatically detects and builds Vite themes at runtime. Just reference your theme in `site.toml`:

```toml
theme = "my-vite-theme"  # Will auto-build if it has package.json + vite.config.*
```

The first build may take a few seconds while dependencies are installed. Subsequent builds are faster since `node_modules/` is reused.

### Vite Configuration

A minimal `vite.config.ts` for galerie themes:

```typescript
import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { resolve } from 'path';

export default defineConfig({
  build: {
    outDir: 'dist/static',
    emptyOutDir: false,  // Rust cleans dist/ before build
    rollupOptions: {
      input: resolve(__dirname, 'src/main.ts'),
      output: {
        entryFileNames: 'app.js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith('.css')) {
            return 'style.css';
          }
          return '[name].[ext]';
        },
        // Use single bundle - Rust hashes filenames but can't
        // update import statements, so chunking doesn't work
        inlineDynamicImports: true,
      },
    },
    cssCodeSplit: false,
  },
  plugins: [
    // Copy templates to dist/templates
    viteStaticCopy({
      targets: [
        {
          src: 'templates/*',
          dest: '../templates',
        },
      ],
    }),
  ],
});
```

**Important**: Use `inlineDynamicImports: true` to create a single bundle. The Rust pipeline adds content hashes to filenames for cache-busting, but it can't update import statements inside JavaScript files, so code splitting between chunks doesn't work.

### TypeScript Configuration

A minimal `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "jsx": "react-jsx",
    "jsxImportSource": "preact"
  },
  "include": ["src/**/*.ts", "src/**/*.tsx"],
  "exclude": ["node_modules", "dist"]
}
```

### Package.json

Minimal `package.json`:

```json
{
  "name": "my-theme",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build"
  },
  "dependencies": {
    "preact": "^10.x"
  },
  "devDependencies": {
    "typescript": "^5.x",
    "vite": "^5.x",
    "vite-plugin-static-copy": "^1.x"
  }
}
```

### Using Preact

For component-based themes, Preact is recommended (~4KB gzipped):

```bash
npm install preact
npm install -D @preact/preset-vite
```

Update `vite.config.ts`:

```typescript
import preact from '@preact/preset-vite';

export default defineConfig({
  // ...
  plugins: [
    preact(),
    // ...
  ],
});
```

### Using SCSS

SCSS is supported out of the box with Vite:

```bash
npm install -D sass
```

Then import SCSS in your entry point:

```typescript
import './styles/main.scss';
```

### Global Variables

Templates inject global JavaScript variables that your theme can use:

```javascript
// Available globally (set by base.html template)
GALLERY_URL    // URL to gallery.json data file
I18N_URLS      // Map of language code to translation JSON URL
I18N_CONFIG    // { languages: [{code, name}], default: string }
```

### External Libraries

For libraries like Masonry.js or Leaflet, load them from CDN in your base template rather than bundling:

```html
<!-- In templates/base.html -->
<script src="https://unpkg.com/masonry-layout@4/dist/masonry.pkgd.min.js"></script>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1/dist/leaflet.css">
<script src="https://unpkg.com/leaflet@1/dist/leaflet.js"></script>
```

Then declare them in TypeScript:

```typescript
// src/types.ts
declare global {
  interface Window {
    Masonry: new (element: HTMLElement, options: object) => MasonryInstance;
    L: typeof import('leaflet');
  }
}
```

## Required Files

### `templates/index.html`

Every theme must have an `index.html` template. This is the site homepage.

See [Templates](templates.md) for details on what context is available.

## Optional Files

### `templates/album.html`

If present, galerie generates a page for each album at `/{album-slug}/index.html`.

### `templates/photo.html`

If present, galerie generates a page for each photo. Useful for SEO. For SPA-style themes, this is typically omitted and JavaScript handles photo viewing.

### `templates/base.html`

By convention, themes use `base.html` as a wrapper that other templates extend.

## Template Functions

### `static(path)`

Resolves a static asset path to its cache-busted URL:

```html
<link rel="stylesheet" href="{{ static(path='style.css') }}">
<!-- Output: /static/style-abc123.css -->

<script type="module" src="{{ static(path='app.js') }}"></script>
<!-- Output: /static/app-def456.js -->
```

## Example: Fancy Theme Structure

The built-in `fancy` theme is a Vite theme built with Preact:

```
themes/fancy/
├── package.json
├── vite.config.ts
├── tsconfig.json
├── src/
│   ├── main.tsx                 # Entry point, renders <App />
│   ├── types.ts                 # TypeScript interfaces
│   ├── config.ts                # Constants
│   ├── store/
│   │   └── galleryStore.ts      # Zustand state management
│   ├── context/
│   │   └── I18nContext.tsx      # i18n React context
│   ├── hooks/
│   │   ├── useHashRouter.ts     # Hash-based routing
│   │   ├── useKeyboardNav.ts    # Keyboard shortcuts
│   │   ├── useTouchSwipe.ts     # Touch gestures
│   │   └── ...
│   ├── components/
│   │   ├── App/
│   │   ├── Header/
│   │   ├── Grid/
│   │   ├── Viewer/
│   │   ├── Drawer/
│   │   ├── Filmstrip/
│   │   └── ...
│   └── utils/
├── styles/
│   └── main.scss
├── templates/
│   ├── base.html
│   └── index.html
└── dist/                        # Generated by npm run build
```

## Using a Theme

Reference a theme in `site.toml`:

```toml
theme = "theme"                    # Relative to site root
theme = "themes/gallery"           # Nested directory
theme = "../shared-themes/minimal" # Outside site root
```

The theme path is always relative to the site root directory.
