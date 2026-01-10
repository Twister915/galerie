# Templates

galerie uses [Tera](https://keats.github.io/tera/) for templating (Jinja2-style syntax). Templates live in your theme's `templates/` directory.

## Well-Known Template Names

galerie uses convention over configuration. The presence of specific template files determines what pages are generated:

| Template | Required | Purpose | Output |
|----------|----------|---------|--------|
| `index.html` | Yes | Site homepage | `/index.html` |
| `album.html` | No | Album index pages | `/{album-slug}/index.html` |
| `photo.html` | No | Individual photo pages | `/{album-slug}/{photo-stem}.html` |
| `base.html` | No | Common wrapper | Not rendered directly |

## Template Details

### `index.html` (required)

The site homepage. Always rendered once.

**Context provided:**
- `site` - Site configuration
- `root` - The root album (contains all photos and child albums)
- `photos` - Flat list of all photos across all albums

**Example:**
```html
{% extends "base.html" %}
{% block content %}
<h1>My Gallery</h1>

{# Show child albums if any #}
{% if root.children %}
<section class="albums">
    {% for album in root.children %}
    <a href="/{{ album.slug }}/">{{ album.name }}</a>
    {% endfor %}
</section>
{% endif %}

{# Show photos #}
<section class="photos">
    {% for photo in photos %}
    <a href="/{{ photo.html_path }}">
        <img src="/{{ photo.image_path }}" alt="{{ photo.stem }}">
    </a>
    {% endfor %}
</section>
{% endblock content %}
```

### `album.html` (optional)

Rendered once for each album (subdirectory in photos). If this template doesn't exist, album pages are not generated.

**Context provided:**
- `site` - Site configuration
- `root` - The root album
- `photos` - Flat list of all photos
- `album` - The current album being rendered

**Example:**
```html
{% extends "base.html" %}
{% block content %}
<h1>{{ album.name }}</h1>
<a href="/">Back to gallery</a>

{% for photo in album.photos %}
<a href="/{{ album.slug }}/{{ photo.stem }}.html">
    <img src="/{{ photo.image_path }}" alt="{{ photo.stem }}">
</a>
{% endfor %}
{% endblock content %}
```

### `photo.html` (optional)

Rendered once for each photo. If this template doesn't exist, individual photo pages are not generated (useful for SPA-style themes).

**Context provided:**
- `site` - Site configuration
- `root` - The root album
- `photos` - Flat list of all photos
- `album` - The album containing this photo
- `photo` - The current photo
- `prev_photo` - Previous photo in album (or null)
- `next_photo` - Next photo in album (or null)

**Example:**
```html
{% extends "base.html" %}
{% block content %}
<nav>
    {% if prev_photo %}
    <a href="/{{ album.slug }}/{{ prev_photo.stem }}.html">Previous</a>
    {% endif %}
    <a href="/{{ album.slug }}/">{{ album.name }}</a>
    {% if next_photo %}
    <a href="/{{ album.slug }}/{{ next_photo.stem }}.html">Next</a>
    {% endif %}
</nav>

<img src="/{{ photo.image_path }}" alt="{{ photo.stem }}">
{% endblock content %}
```

### `base.html` (optional, convention)

A common wrapper template that other templates extend. This is a convention, not enforced by galerie.

**Example:**
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{% block title %}{{ site.domain }}{% endblock title %}</title>
    <link rel="stylesheet" href="/static/style.css">
</head>
<body>
    {% block content %}{% endblock content %}
</body>
</html>
```

## Theme Compatibility Levels

Themes can support different levels of functionality:

1. **Minimal** - Only `index.html`
   - Single page with all photos
   - Good for SPA-style JavaScript galleries

2. **Album-aware** - `index.html` + `album.html`
   - Homepage lists albums
   - Each album has its own page
   - Photos shown inline or via JavaScript

3. **Full** - `index.html` + `album.html` + `photo.html`
   - Complete multi-page experience
   - Individual photo pages with prev/next navigation
