# Template Context

This document describes all variables available in galerie templates.

## Global Context

These variables are available in all templates:

### `site`

Site configuration from `site.toml`.

| Field | Type | Description |
|-------|------|-------------|
| `site.domain` | string | The configured domain |
| `site.title` | string | Site title (defaults to domain if not set) |

### `theme_config`

Theme configuration merged from theme defaults and user overrides. See [Site Configuration](site-config.md#theme-configuration) for details.

```html
{% if theme_config.slideshow_delay %}
    <div data-delay="{{ theme_config.slideshow_delay }}">...</div>
{% endif %}
```

In JavaScript (for Vite themes):
```javascript
const delay = THEME_CONFIG.slideshow_delay ?? 5000;
```

### `root`

The root album containing all photos and child albums. See [Album](#album) for structure.

### `photos`

A flat list of all photos across all albums. Useful for showing everything on the homepage.

```html
{% for photo in photos %}
    <img src="/{{ photo.image_path }}">
{% endfor %}
```

## Page-Specific Context

### In `album.html`

| Variable | Type | Description |
|----------|------|-------------|
| `album` | Album | The album being rendered |

### In `photo.html`

| Variable | Type | Description |
|----------|------|-------------|
| `album` | Album | Album containing this photo |
| `photo` | Photo | The photo being rendered |
| `prev_photo` | Photo or null | Previous photo in album |
| `next_photo` | Photo or null | Next photo in album |

## Types

### Photo

Represents a single image with multiple variants and extracted metadata.

| Field | Type | Description |
|-------|------|-------------|
| `stem` | string | Filename without extension (e.g., "DSC01234") |
| `extension` | string | File extension without dot (e.g., "jpg") |
| `hash` | string | Content hash for cache-busting (8 hex chars) |
| `image_path` | string | URL path to full-size WebP |
| `thumb_path` | string | URL path to thumbnail WebP (600px) |
| `original_path` | string | URL path to original file (for downloads) |
| `html_path` | string | URL path to the photo's HTML page |
| `metadata` | PhotoMetadata | Extracted EXIF metadata |

**Example usage:**
```html
{# Grid thumbnail with link to detail page #}
<a href="/{{ photo.html_path | safe }}">
    <img src="/{{ photo.thumb_path | safe }}" alt="{{ photo.stem }}" loading="lazy">
</a>

{# Full-size image on detail page #}
<img src="/{{ photo.image_path | safe }}" alt="{{ photo.stem }}">

{# Download original #}
<a href="/{{ photo.original_path | safe }}" download>Download Original</a>
```

### PhotoMetadata

EXIF metadata extracted from the photo. All fields are optional.

| Field | Type | Description |
|-------|------|-------------|
| `date_taken` | string or null | Date/time taken (EXIF format) |
| `copyright` | string or null | Copyright notice |
| `camera` | string or null | Camera make and model |
| `lens` | string or null | Lens model |
| `gps` | GpsCoords or null | GPS coordinates |
| `exposure` | ExposureInfo or null | Exposure settings |

### GpsCoords

GPS location data. Some fields are privacy-aware based on the `gps` setting in `site.toml`.

| Field | Type | Privacy | Description |
|-------|------|---------|-------------|
| `latitude` | number or null | `on` only | Latitude in decimal degrees |
| `longitude` | number or null | `on` only | Longitude in decimal degrees |
| `display` | string or null | `on` only | Formatted coordinates (e.g., "35.6762, 139.6503") |
| `city` | string or null | `on`, `general` | City name via reverse geocoding |
| `region` | string or null | `on`, `general` | State/province/region |
| `country` | string or null | `on`, `general` | Country name |
| `countryCode` | string or null | `on`, `general` | ISO 3166-1 alpha-2 code (e.g., "JP") |
| `flag` | string or null | `on`, `general` | Country flag emoji |

When `gps = "general"`: `latitude`, `longitude`, and `display` are `null`, but location context (city, region, country) is still available.

When `gps = "off"`: The entire `gps` object is `null`.

### ExposureInfo

| Field | Type | Description |
|-------|------|-------------|
| `aperture` | string or null | Aperture (e.g., "f/2.8") |
| `shutter_speed` | string or null | Shutter speed (e.g., "1/250") |
| `iso` | number or null | ISO sensitivity |
| `focal_length` | string or null | Focal length (e.g., "50mm") |

**Example metadata usage:**
```html
{% if photo.metadata.camera %}
    <span>Shot on {{ photo.metadata.camera }}</span>
{% endif %}

{% if photo.metadata.exposure %}
    <span>
        {{ photo.metadata.exposure.aperture }}
        {{ photo.metadata.exposure.shutter_speed }}
        ISO {{ photo.metadata.exposure.iso }}
    </span>
{% endif %}

{% if photo.metadata.gps %}
    {# Show map link only when coordinates are available (gps = "on") #}
    {% if photo.metadata.gps.latitude %}
        <a href="https://maps.google.com/?q={{ photo.metadata.gps.latitude }},{{ photo.metadata.gps.longitude }}">
            View on map
        </a>
    {% endif %}

    {# Location context works with gps = "on" or "general" #}
    {% if photo.metadata.gps.city %}
        <span>{{ photo.metadata.gps.city }}, {{ photo.metadata.gps.country }} {{ photo.metadata.gps.flag }}</span>
    {% endif %}
{% endif %}
```

### Album

Represents a collection of photos, possibly with child albums.

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Display name (directory name, titlecased) |
| `slug` | string | URL-safe identifier (directory name, lowercased) |
| `photos` | list of Photo | Photos directly in this album |
| `children` | list of Album | Child albums (subdirectories) |

**Example usage:**
```html
<h1>{{ album.name }}</h1>

{# List child albums #}
{% for child in album.children %}
    <a href="/{{ child.slug }}/">{{ child.name }}</a>
{% endfor %}

{# List photos with thumbnails #}
{% for photo in photos %}
    <img src="/{{ photo.thumb_path | safe }}" loading="lazy">
{% endfor %}
```

## Tera Syntax Reference

galerie uses Tera templating. Common patterns:

**Variables:**
```html
{{ variable }}
{{ object.field }}
```

**Conditionals:**
```html
{% if condition %}
    ...
{% elif other %}
    ...
{% else %}
    ...
{% endif %}
```

**Loops:**
```html
{% for item in items %}
    {{ item }}
    {{ loop.index }}     {# 1-based index #}
    {{ loop.index0 }}    {# 0-based index #}
    {{ loop.first }}     {# true on first iteration #}
    {{ loop.last }}      {# true on last iteration #}
{% endfor %}
```

**Template inheritance:**
```html
{# base.html #}
<!DOCTYPE html>
<html>
<body>{% block content %}{% endblock content %}</body>
</html>

{# page.html #}
{% extends "base.html" %}
{% block content %}
    Page content here
{% endblock content %}
```

**Includes:**
```html
{% include "partials/header.html" %}
```

See the [Tera documentation](https://keats.github.io/tera/docs/) for complete syntax reference.
