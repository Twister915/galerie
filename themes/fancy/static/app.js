/**
 * Galerie Fancy Theme - Single Page Application
 *
 * Architecture:
 * - State management via a central state object
 * - Hash-based routing (#/photo/stem, #/album/slug)
 * - Components: Grid, Viewer, Filmstrip, Drawer, Map
 * - Event delegation for performance
 * - Progressive loading for large galleries
 */

(function() {
    'use strict';

    // ==========================================================================
    // Configuration
    // ==========================================================================

    const GRID_BATCH_SIZE = 40;           // Photos to load per batch
    const FILMSTRIP_BUFFER = 10;          // Extra thumbnails to render outside viewport
    const FILMSTRIP_THUMB_WIDTH = 68;     // Thumbnail width + gap for positioning

    // ==========================================================================
    // State
    // ==========================================================================

    const state = {
        photos: [],         // Original order (for filmstrip/navigation)
        gridOrder: [],      // Indices sorted by hash (for grid display)
        albums: [],
        site: {},
        currentPhotoIndex: -1,
        drawerOpen: false,
        masonry: null,
        map: null,
        filterAlbum: null,
        // Progressive loading state
        gridLoadedCount: 0,
        gridLoading: false,
        gridObserver: null,
        // Filmstrip virtualization
        filmstripStart: 0,
        filmstripEnd: 0
    };

    // ==========================================================================
    // i18n (Internationalization)
    // ==========================================================================

    const i18nData = JSON.parse(document.getElementById('i18n-data').textContent);
    const i18nConfig = JSON.parse(document.getElementById('i18n-config').textContent);

    function detectLang() {
        var langs = navigator.languages || [navigator.language];
        for (var i = 0; i < langs.length; i++) {
            var browserLang = langs[i];
            var normalized = browserLang.replace('-', '_');
            if (i18nData[normalized]) return normalized;
            var prefix = browserLang.split('-')[0];
            for (var lang in i18nData) {
                if (lang.indexOf(prefix) === 0) return lang;
            }
        }
        return i18nConfig.default;
    }

    function getLang() {
        return localStorage.getItem('lang') || detectLang();
    }

    function setLang(lang) {
        localStorage.setItem('lang', lang);
        document.documentElement.lang = lang;
        applyTranslations();
        // Re-render current content
        if (state.currentPhotoIndex >= 0) {
            updateDrawerContent(state.photos[state.currentPhotoIndex]);
        }
        updateLangPicker();
    }

    function applyTranslations() {
        var elements = document.querySelectorAll('[data-i18n]');
        for (var i = 0; i < elements.length; i++) {
            elements[i].textContent = t(elements[i].getAttribute('data-i18n'));
        }
    }

    function t(key) {
        var lang = getLang();
        if (i18nData[lang] && typeof i18nData[lang][key] === 'string') {
            return i18nData[lang][key];
        }
        if (i18nData[i18nConfig.default] && typeof i18nData[i18nConfig.default][key] === 'string') {
            return i18nData[i18nConfig.default][key];
        }
        return key;
    }

    function updateLangPicker() {
        var current = getLang();
        var dropdown = document.getElementById('lang-dropdown');
        if (!dropdown) return;

        // Update current language display
        var currentEl = document.getElementById('lang-current');
        var items = dropdown.querySelectorAll('.lang-dropdown-item');
        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            var isActive = item.getAttribute('data-lang') === current;
            item.classList.toggle('active', isActive);
            if (isActive && currentEl) {
                currentEl.textContent = item.textContent;
            }
        }
    }

    function toggleLangDropdown() {
        var dropdown = document.getElementById('lang-dropdown');
        var trigger = document.getElementById('lang-dropdown-trigger');
        if (!dropdown || !trigger) return;

        var isOpen = dropdown.classList.toggle('open');
        trigger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    }

    function closeLangDropdown() {
        var dropdown = document.getElementById('lang-dropdown');
        var trigger = document.getElementById('lang-dropdown-trigger');
        if (!dropdown || !trigger) return;

        dropdown.classList.remove('open');
        trigger.setAttribute('aria-expanded', 'false');
    }

    // ==========================================================================
    // Utilities
    // ==========================================================================

    /**
     * Simple string hash function for deterministic shuffling.
     */
    function simpleHash(str) {
        var hash = 5381;
        for (var i = 0; i < str.length; i++) {
            hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
        }
        return hash >>> 0;
    }

    // ==========================================================================
    // DOM Elements (cached)
    // ==========================================================================

    const dom = {
        header: null,
        gallery: null,
        grid: null,
        viewer: null,
        viewerBackdrop: null,
        viewerImage: null,
        viewerClose: null,
        viewerPrev: null,
        viewerNext: null,
        infoDrawer: null,
        drawerToggle: null,
        drawerContent: null,
        filmstrip: null,
        filmstripTrack: null,
        loadingSentinel: null
    };

    // ==========================================================================
    // Initialization
    // ==========================================================================

    function init() {
        const dataScript = document.getElementById('photo-data');
        if (!dataScript) {
            console.error('Photo data not found');
            return;
        }

        try {
            const data = JSON.parse(dataScript.textContent);
            state.photos = data.photos;
            state.albums = data.albums;
            state.site = data.site;

            // Create grid order: indices sorted by hashed-hash for visual variety
            state.gridOrder = state.photos
                .map(function(photo, index) { return { index: index, sortKey: simpleHash(photo.hash) }; })
                .sort(function(a, b) { return a.sortKey - b.sortKey; })
                .map(function(item) { return item.index; });
        } catch (e) {
            console.error('Failed to parse photo data:', e);
            return;
        }

        cacheDomElements();
        setupGrid();
        setupFilmstrip();
        setupLangPicker();
        setupEventListeners();
        handleRoute();
    }

    function setupLangPicker() {
        // Set document language and apply translations
        document.documentElement.lang = getLang();
        applyTranslations();

        var dropdown = document.getElementById('lang-dropdown');
        var trigger = document.getElementById('lang-dropdown-trigger');
        if (!dropdown || !trigger) return;

        // Toggle dropdown on trigger click
        trigger.addEventListener('click', function(e) {
            e.stopPropagation();
            toggleLangDropdown();
        });

        // Handle language selection
        var items = dropdown.querySelectorAll('.lang-dropdown-item');
        for (var i = 0; i < items.length; i++) {
            (function(item) {
                item.addEventListener('click', function() {
                    setLang(item.getAttribute('data-lang'));
                    closeLangDropdown();
                });
            })(items[i]);
        }

        // Close dropdown when clicking outside
        document.addEventListener('click', function(e) {
            if (!dropdown.contains(e.target)) {
                closeLangDropdown();
            }
        });

        // Close dropdown on escape
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && dropdown.classList.contains('open')) {
                closeLangDropdown();
                trigger.focus();
            }
        });

        updateLangPicker();
    }

    function cacheDomElements() {
        dom.header = document.querySelector('.site-header');
        dom.gallery = document.getElementById('gallery');
        dom.grid = document.getElementById('masonry-grid');
        dom.viewer = document.getElementById('photo-viewer');
        dom.viewerBackdrop = document.getElementById('viewer-backdrop');
        dom.viewerImage = document.getElementById('viewer-image');
        dom.viewerClose = document.getElementById('viewer-close');
        dom.viewerPrev = document.getElementById('viewer-prev');
        dom.viewerNext = document.getElementById('viewer-next');
        dom.infoDrawer = document.getElementById('info-drawer');
        dom.drawerToggle = document.getElementById('drawer-toggle');
        dom.drawerContent = document.getElementById('drawer-content');
        dom.filmstrip = document.getElementById('filmstrip');
    }

    // ==========================================================================
    // Grid - Progressive Loading
    // ==========================================================================

    function getTileSizeClass(hash) {
        const value = parseInt(hash.substring(0, 2), 16);
        if (value < 25) return 'size-4x';
        if (value < 102) return 'size-2x';
        return 'size-1x';
    }

    function setupGrid() {
        // Add sizers for Masonry
        dom.grid.innerHTML = '<div class="grid-sizer"></div><div class="gutter-sizer"></div>';

        // Create loading sentinel (triggers infinite scroll)
        dom.loadingSentinel = document.createElement('div');
        dom.loadingSentinel.className = 'loading-sentinel';
        dom.loadingSentinel.style.cssText = 'height:1px;width:100%;clear:both;';

        // Load initial batch
        loadMorePhotos();

        // Initialize Masonry immediately (aspect ratios handle pre-layout)
        state.masonry = new Masonry(dom.grid, {
            itemSelector: '.photo-tile',
            columnWidth: '.grid-sizer',
            gutter: '.gutter-sizer',
            fitWidth: true,
            transitionDuration: 0,
            initLayout: false
        });

        // Layout after first images start loading
        requestAnimationFrame(function() {
            state.masonry.layout();
        });

        // Set up intersection observer for infinite scroll
        state.gridObserver = new IntersectionObserver(function(entries) {
            if (entries[0].isIntersecting && !state.gridLoading) {
                loadMorePhotos();
            }
        }, {
            rootMargin: '200px'
        });

        // Append sentinel after grid
        dom.grid.parentNode.insertBefore(dom.loadingSentinel, dom.grid.nextSibling);
        state.gridObserver.observe(dom.loadingSentinel);
    }

    function loadMorePhotos() {
        if (state.gridLoadedCount >= state.gridOrder.length) {
            // All photos loaded, remove sentinel
            if (dom.loadingSentinel.parentNode) {
                dom.loadingSentinel.parentNode.removeChild(dom.loadingSentinel);
            }
            return;
        }

        state.gridLoading = true;

        const startIndex = state.gridLoadedCount;
        const endIndex = Math.min(startIndex + GRID_BATCH_SIZE, state.gridOrder.length);
        const fragment = document.createDocumentFragment();
        const newTiles = [];

        for (var i = startIndex; i < endIndex; i++) {
            const photoIndex = state.gridOrder[i];
            const photo = state.photos[photoIndex];
            const tile = createTile(photo, photoIndex);
            fragment.appendChild(tile);
            newTiles.push(tile);
        }

        // Append to grid
        dom.grid.appendChild(fragment);
        state.gridLoadedCount = endIndex;

        // Tell Masonry about new items
        if (state.masonry && newTiles.length > 0) {
            state.masonry.appended(newTiles);

            // Re-layout after images load
            imagesLoaded(newTiles, function() {
                state.masonry.layout();
            });
        }

        state.gridLoading = false;
    }

    function createTile(photo, index) {
        const sizeClass = getTileSizeClass(photo.hash);

        const tile = document.createElement('div');
        tile.className = 'photo-tile ' + sizeClass;
        tile.dataset.index = index;
        tile.dataset.stem = photo.stem;

        const img = document.createElement('img');
        img.src = photo.thumbPath;
        img.alt = photo.stem;
        img.loading = 'lazy';
        img.decoding = 'async';

        if (photo.width && photo.height) {
            img.style.aspectRatio = photo.width + ' / ' + photo.height;
        }

        tile.appendChild(img);
        return tile;
    }

    // ==========================================================================
    // Filmstrip - Virtualized
    // ==========================================================================

    function setupFilmstrip() {
        // Create inner track for virtualized content
        dom.filmstripTrack = document.createElement('div');
        dom.filmstripTrack.className = 'filmstrip-track';
        dom.filmstripTrack.style.cssText = 'display:flex;gap:8px;position:relative;';

        // Set total width to enable proper scrolling
        const totalWidth = state.photos.length * FILMSTRIP_THUMB_WIDTH;
        dom.filmstripTrack.style.width = totalWidth + 'px';

        dom.filmstrip.appendChild(dom.filmstripTrack);

        // Listen for scroll to update visible range
        dom.filmstrip.addEventListener('scroll', updateFilmstripVisibleRange, { passive: true });
    }

    function updateFilmstripVisibleRange() {
        const scrollLeft = dom.filmstrip.scrollLeft;
        const viewportWidth = dom.filmstrip.clientWidth;

        // Calculate visible range with buffer
        const startIndex = Math.max(0, Math.floor(scrollLeft / FILMSTRIP_THUMB_WIDTH) - FILMSTRIP_BUFFER);
        const endIndex = Math.min(
            state.photos.length,
            Math.ceil((scrollLeft + viewportWidth) / FILMSTRIP_THUMB_WIDTH) + FILMSTRIP_BUFFER
        );

        // Only update if range changed significantly
        if (startIndex === state.filmstripStart && endIndex === state.filmstripEnd) {
            return;
        }

        state.filmstripStart = startIndex;
        state.filmstripEnd = endIndex;

        renderFilmstripRange(startIndex, endIndex);
    }

    function renderFilmstripRange(start, end) {
        // Clear existing thumbnails
        dom.filmstripTrack.innerHTML = '';

        const fragment = document.createDocumentFragment();

        for (var i = start; i < end; i++) {
            const photo = state.photos[i];

            const thumb = document.createElement('div');
            thumb.className = 'filmstrip-thumb' + (i === state.currentPhotoIndex ? ' active' : '');
            thumb.dataset.index = i;
            thumb.style.cssText = 'position:absolute;left:' + (i * FILMSTRIP_THUMB_WIDTH) + 'px;';

            const img = document.createElement('img');
            img.src = photo.thumbPath;
            img.alt = photo.stem;

            thumb.appendChild(img);
            fragment.appendChild(thumb);
        }

        dom.filmstripTrack.appendChild(fragment);
    }

    function updateFilmstrip() {
        // Update active state on visible thumbnails
        var thumbs = dom.filmstripTrack.querySelectorAll('.filmstrip-thumb');
        for (var i = 0; i < thumbs.length; i++) {
            var idx = parseInt(thumbs[i].dataset.index, 10);
            thumbs[i].classList.toggle('active', idx === state.currentPhotoIndex);
        }
        scrollFilmstripToActive();
    }

    function scrollFilmstripToActive() {
        if (state.currentPhotoIndex < 0) return;

        // Calculate position and scroll
        const targetScroll = (state.currentPhotoIndex * FILMSTRIP_THUMB_WIDTH) -
            (dom.filmstrip.clientWidth / 2) + (FILMSTRIP_THUMB_WIDTH / 2);

        dom.filmstrip.scrollTo({
            left: Math.max(0, targetScroll),
            behavior: 'smooth'
        });

        // Update visible range after scroll
        setTimeout(updateFilmstripVisibleRange, 50);
    }

    // ==========================================================================
    // Viewer
    // ==========================================================================

    function openViewer(index) {
        if (index < 0 || index >= state.photos.length) return;

        state.currentPhotoIndex = index;
        const photo = state.photos[index];

        window.location.hash = '/photo/' + encodeURIComponent(photo.stem);

        dom.viewer.hidden = false;
        document.body.classList.add('viewer-open');

        dom.viewerImage.src = photo.imagePath;
        dom.viewerImage.alt = photo.stem;

        updateNavButtons();
        updateFilmstripVisibleRange();
        updateFilmstrip();
        updateDrawerContent(photo);
        preloadAdjacentImages(index);

        // Reinitialize map if drawer is open and photo has GPS with coordinates
        if (state.drawerOpen) {
            if (state.map) {
                state.map.remove();
                state.map = null;
            }
            if (photo.metadata.gps && photo.metadata.gps.latitude !== null && photo.metadata.gps.longitude !== null) {
                setTimeout(function() {
                    initMap(photo.metadata.gps);
                }, 100);
            }
        }
    }

    function closeViewer() {
        state.currentPhotoIndex = -1;
        state.drawerOpen = false;
        dom.viewer.hidden = true;
        dom.viewer.classList.remove('drawer-open');
        dom.drawerToggle.classList.remove('active');
        document.body.classList.remove('viewer-open');
        window.location.hash = '';

        if (state.map) {
            state.map.remove();
            state.map = null;
        }
    }

    function navigatePhoto(direction) {
        const newIndex = state.currentPhotoIndex + direction;
        if (newIndex >= 0 && newIndex < state.photos.length) {
            openViewer(newIndex);
        }
    }

    function updateNavButtons() {
        dom.viewerPrev.disabled = state.currentPhotoIndex <= 0;
        dom.viewerNext.disabled = state.currentPhotoIndex >= state.photos.length - 1;
    }

    function preloadAdjacentImages(index) {
        [index - 1, index + 1, index - 2, index + 2].forEach(function(i) {
            if (i >= 0 && i < state.photos.length) {
                var img = new Image();
                img.src = state.photos[i].imagePath;
            }
        });
    }

    // ==========================================================================
    // Info Drawer
    // ==========================================================================

    function toggleDrawer() {
        state.drawerOpen = !state.drawerOpen;
        dom.viewer.classList.toggle('drawer-open', state.drawerOpen);
        dom.drawerToggle.classList.toggle('active', state.drawerOpen);

        if (state.drawerOpen && state.currentPhotoIndex >= 0) {
            const photo = state.photos[state.currentPhotoIndex];
            if (photo.metadata.gps && photo.metadata.gps.latitude !== null && photo.metadata.gps.longitude !== null) {
                setTimeout(function() {
                    initMap(photo.metadata.gps);
                }, 100);
            }
        } else if (!state.drawerOpen && state.map) {
            state.map.remove();
            state.map = null;
        }
    }

    function updateDrawerContent(photo) {
        const meta = photo.metadata;
        let html = '';

        html += '<div class="meta-section">';
        html += '<h3>' + t('section.photo') + '</h3>';
        html += '<div class="meta-item">';
        html += '<span class="meta-label">' + t('field.name') + '</span>';
        html += '<span class="meta-value">' + escapeHtml(photo.stem) + '</span>';
        html += '</div>';
        html += '</div>';

        if (meta.dateTaken) {
            html += '<div class="meta-section">';
            html += '<h3>' + t('section.date') + '</h3>';
            html += '<div class="meta-item">';
            html += '<span class="meta-label">' + t('field.taken') + '</span>';
            html += '<span class="meta-value">' + escapeHtml(meta.dateTaken) + '</span>';
            html += '</div>';
            html += '</div>';
        }

        if (meta.camera || meta.lens) {
            html += '<div class="meta-section">';
            html += '<h3>' + t('section.camera') + '</h3>';
            if (meta.camera) {
                html += '<div class="meta-item">';
                html += '<span class="meta-label">' + t('field.camera') + '</span>';
                html += '<span class="meta-value">' + escapeHtml(meta.camera) + '</span>';
                html += '</div>';
            }
            if (meta.lens) {
                html += '<div class="meta-item">';
                html += '<span class="meta-label">' + t('field.lens') + '</span>';
                html += '<span class="meta-value">' + escapeHtml(meta.lens) + '</span>';
                html += '</div>';
            }
            html += '</div>';
        }

        if (meta.exposure) {
            const exp = meta.exposure;
            html += '<div class="meta-section">';
            html += '<h3>' + t('section.exposure') + '</h3>';
            if (exp.aperture) {
                html += '<div class="meta-item">';
                html += '<span class="meta-label">' + t('field.aperture') + '</span>';
                html += '<span class="meta-value">' + escapeHtml(exp.aperture) + '</span>';
                html += '</div>';
            }
            if (exp.shutterSpeed) {
                html += '<div class="meta-item">';
                html += '<span class="meta-label">' + t('field.shutter') + '</span>';
                html += '<span class="meta-value">' + escapeHtml(exp.shutterSpeed) + '</span>';
                html += '</div>';
            }
            if (exp.iso) {
                html += '<div class="meta-item">';
                html += '<span class="meta-label">' + t('field.iso') + '</span>';
                html += '<span class="meta-value">' + exp.iso + '</span>';
                html += '</div>';
            }
            if (exp.focalLength) {
                html += '<div class="meta-item">';
                html += '<span class="meta-label">' + t('field.focal_length') + '</span>';
                html += '<span class="meta-value">' + escapeHtml(exp.focalLength) + '</span>';
                html += '</div>';
            }
            html += '</div>';
        }

        if (meta.gps) {
            html += '<div class="meta-section">';
            html += '<h3>' + t('section.location') + '</h3>';
            if (meta.gps.city) {
                var locationParts = [meta.gps.city];
                if (meta.gps.region) locationParts.push(meta.gps.region);
                html += '<div class="meta-item">';
                html += '<span class="meta-label">' + t('field.place') + '</span>';
                html += '<span class="meta-value">' + escapeHtml(locationParts.join(', ')) + '</span>';
                html += '</div>';
            }
            if (meta.gps.country) {
                // Use translated country name if available, otherwise fall back to raw name
                var countryName = meta.gps.countryCode
                    ? (t('country.' + meta.gps.countryCode) !== 'country.' + meta.gps.countryCode
                        ? t('country.' + meta.gps.countryCode)
                        : meta.gps.country)
                    : meta.gps.country;
                html += '<div class="meta-item">';
                html += '<span class="meta-label">' + t('field.country') + '</span>';
                html += '<span class="meta-value">' + (meta.gps.flag || '') + ' ' + escapeHtml(countryName) + '</span>';
                html += '</div>';
            }
            // Only show coordinates and map if display is present (not in "general" mode)
            if (meta.gps.display !== null) {
                html += '<div class="meta-item">';
                html += '<span class="meta-label">' + t('field.coordinates') + '</span>';
                html += '<span class="meta-value">' + escapeHtml(meta.gps.display) + '</span>';
                html += '</div>';
                html += '<div class="map-container" id="map"></div>';
            }
            html += '</div>';
        }

        if (meta.copyright) {
            html += '<div class="meta-section">';
            html += '<h3>' + t('section.copyright') + '</h3>';
            html += '<div class="meta-item">';
            html += '<span class="meta-value">' + escapeHtml(meta.copyright) + '</span>';
            html += '</div>';
            html += '</div>';
        }

        html += '<a href="' + photo.originalPath + '" class="download-link" download>';
        html += t('action.download');
        html += '</a>';

        dom.drawerContent.innerHTML = html;
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ==========================================================================
    // Map (Leaflet)
    // ==========================================================================

    function initMap(gps) {
        const mapContainer = document.getElementById('map');
        if (!mapContainer) return;

        if (state.map) {
            state.map.remove();
        }

        state.map = L.map('map', {
            zoomControl: false,
            attributionControl: false
        }).setView([gps.latitude, gps.longitude], 14);

        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19
        }).addTo(state.map);

        L.marker([gps.latitude, gps.longitude]).addTo(state.map);

        setTimeout(function() {
            if (state.map) {
                state.map.invalidateSize();
            }
        }, 300);
    }

    // ==========================================================================
    // Routing
    // ==========================================================================

    function handleRoute() {
        const hash = window.location.hash.slice(1);

        if (!hash) {
            if (state.currentPhotoIndex >= 0) {
                closeViewer();
            }
            return;
        }

        const photoMatch = hash.match(/^\/photo\/(.+)$/);
        if (photoMatch) {
            const stem = decodeURIComponent(photoMatch[1]);
            const index = state.photos.findIndex(function(p) {
                return p.stem === stem;
            });
            if (index >= 0 && index !== state.currentPhotoIndex) {
                openViewer(index);
            }
            return;
        }

        const albumMatch = hash.match(/^\/album\/(.+)$/);
        if (albumMatch) {
            const slug = decodeURIComponent(albumMatch[1]);
            filterByAlbum(slug);
            return;
        }
    }

    function filterByAlbum(slug) {
        state.filterAlbum = slug;
        document.querySelectorAll('.album-link').forEach(function(link) {
            link.classList.toggle('active', link.dataset.album === slug);
        });
    }

    // ==========================================================================
    // Event Listeners
    // ==========================================================================

    function setupEventListeners() {
        dom.grid.addEventListener('click', function(e) {
            const tile = e.target.closest('.photo-tile');
            if (tile) {
                const index = parseInt(tile.dataset.index, 10);
                openViewer(index);
            }
        });

        dom.viewerClose.addEventListener('click', closeViewer);
        dom.viewerBackdrop.addEventListener('click', closeViewer);
        dom.viewerPrev.addEventListener('click', function() { navigatePhoto(-1); });
        dom.viewerNext.addEventListener('click', function() { navigatePhoto(1); });
        dom.drawerToggle.addEventListener('click', toggleDrawer);

        dom.filmstrip.addEventListener('click', function(e) {
            const thumb = e.target.closest('.filmstrip-thumb');
            if (thumb) {
                const index = parseInt(thumb.dataset.index, 10);
                openViewer(index);
            }
        });

        document.addEventListener('keydown', handleKeydown);
        window.addEventListener('hashchange', handleRoute);

        var lastScrollY = 0;
        window.addEventListener('scroll', function() {
            var currentScrollY = window.scrollY;
            if (currentScrollY > lastScrollY && currentScrollY > 60) {
                dom.header.classList.add('hidden');
            } else {
                dom.header.classList.remove('hidden');
            }
            lastScrollY = currentScrollY;
        }, { passive: true });
    }

    function handleKeydown(e) {
        if (state.currentPhotoIndex < 0) return;

        switch (e.key) {
            case 'ArrowLeft':
            case 'ArrowUp':
                e.preventDefault();
                navigatePhoto(-1);
                break;
            case 'ArrowRight':
            case 'ArrowDown':
                e.preventDefault();
                navigatePhoto(1);
                break;
            case 'i':
            case 'I':
                e.preventDefault();
                toggleDrawer();
                break;
            case 'Escape':
                e.preventDefault();
                if (state.drawerOpen) {
                    toggleDrawer();
                } else {
                    closeViewer();
                }
                break;
        }
    }

    // ==========================================================================
    // Start
    // ==========================================================================

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
