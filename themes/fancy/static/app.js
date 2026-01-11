/**
 * Galerie Fancy Theme - Single Page Application
 *
 * Architecture:
 * - Async data loading from static JSON files
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

    var GRID_BATCH_SIZE = 40;           // Photos to load per batch
    var FILMSTRIP_BUFFER = 10;          // Extra thumbnails to render outside viewport
    var FILMSTRIP_THUMB_WIDTH = 68;     // Thumbnail width + gap for positioning
    var SLIDESHOW_DELAY = 5000;         // 5 seconds between photos in slideshow
    var SWIPE_THRESHOLD = 50;           // Minimum distance for swipe gesture
    var SWIPE_TIME_LIMIT = 300;         // Max time for swipe gesture (ms)
    var CONTROLS_HIDE_DELAY = 2000;     // Auto-hide controls after 2 seconds
    var NAVIGATION_DEBOUNCE = 100;      // Debounce navigation inputs (ms)

    // ==========================================================================
    // State
    // ==========================================================================

    var state = {
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
        filmstripEnd: 0,
        // Big picture / slideshow mode
        bigPictureMode: false,
        controlsTimeout: null,
        slideshowPlaying: false,
        slideshowInterval: null,
        // Navigation generation counter (to ignore stale crossfade callbacks)
        navigationGen: 0,
        // Debounce: timestamp of last navigation
        lastNavigationTime: 0
    };

    // Touch handling state
    var touchState = {
        startX: 0,
        startY: 0,
        startTime: 0
    };

    // ==========================================================================
    // Data Loading
    // ==========================================================================

    var i18nData = {};  // Map of lang code -> translations
    var galleryData = null;

    // Cache key for gallery (includes URL hash for automatic invalidation)
    var GALLERY_CACHE_KEY = 'galerie-gallery-' + GALLERY_URL;

    // Get cache key for a specific language
    function getI18nCacheKey(lang) {
        return 'galerie-i18n-' + I18N_URLS[lang];
    }

    // Load translations for a specific language
    function loadI18nLang(lang) {
        var url = I18N_URLS[lang];
        if (!url) {
            return Promise.resolve();
        }

        var cacheKey = getI18nCacheKey(lang);
        var cached = null;

        try {
            cached = localStorage.getItem(cacheKey);
        } catch (e) { /* localStorage not available */ }

        if (cached) {
            try {
                i18nData[lang] = JSON.parse(cached);
                return Promise.resolve();
            } catch (e) {
                cached = null;
            }
        }

        return fetch(url)
            .then(function(r) { return r.json(); })
            .then(function(data) {
                i18nData[lang] = data;
                try {
                    localStorage.setItem(cacheKey, JSON.stringify(data));
                } catch (e) { /* localStorage full or not available */ }
            });
    }

    function loadData() {
        var promises = [];

        // Load i18n for current language and default language
        var currentLang = localStorage.getItem('lang') || detectLangFromBrowser();
        promises.push(loadI18nLang(currentLang));

        // Also load default language as fallback (if different)
        if (currentLang !== I18N_CONFIG.default) {
            promises.push(loadI18nLang(I18N_CONFIG.default));
        }

        // Load gallery
        var galleryCached = null;
        try {
            galleryCached = localStorage.getItem(GALLERY_CACHE_KEY);
        } catch (e) { /* localStorage not available */ }

        if (galleryCached) {
            try {
                galleryData = JSON.parse(galleryCached);
            } catch (e) {
                galleryCached = null;
            }
        }

        if (!galleryCached) {
            promises.push(
                fetch(GALLERY_URL)
                    .then(function(r) { return r.json(); })
                    .then(function(data) {
                        galleryData = data;
                        try {
                            localStorage.setItem(GALLERY_CACHE_KEY, JSON.stringify(data));
                        } catch (e) { /* localStorage full or not available */ }
                    })
            );
        }

        return Promise.all(promises);
    }

    // ==========================================================================
    // i18n (Internationalization)
    // ==========================================================================

    // Detect language from browser settings (before translations are loaded)
    function detectLangFromBrowser() {
        var langs = navigator.languages || [navigator.language];
        for (var i = 0; i < langs.length; i++) {
            var browserLang = langs[i];
            var normalized = browserLang.replace('-', '_');
            if (I18N_URLS[normalized]) return normalized;
            var prefix = browserLang.split('-')[0];
            for (var lang in I18N_URLS) {
                if (lang.indexOf(prefix) === 0) return lang;
            }
        }
        return I18N_CONFIG.default;
    }

    function getLang() {
        return localStorage.getItem('lang') || detectLangFromBrowser();
    }

    function setLang(lang) {
        // If language not loaded yet, fetch it first
        if (!i18nData[lang]) {
            document.body.classList.add('loading-lang');
            loadI18nLang(lang).then(function() {
                document.body.classList.remove('loading-lang');
                applyLangChange(lang);
            }).catch(function() {
                document.body.classList.remove('loading-lang');
                // Fall back to applying anyway
                applyLangChange(lang);
            });
        } else {
            applyLangChange(lang);
        }
    }

    function applyLangChange(lang) {
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
        if (i18nData[I18N_CONFIG.default] && typeof i18nData[I18N_CONFIG.default][key] === 'string') {
            return i18nData[I18N_CONFIG.default][key];
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

    var dom = {
        header: null,
        gallery: null,
        grid: null,
        viewer: null,
        viewerBackdrop: null,
        viewerImage: null,
        viewerImageNext: null,
        viewerImageContainer: null,
        viewerClose: null,
        viewerPrev: null,
        viewerNext: null,
        infoDrawer: null,
        drawerToggle: null,
        drawerContent: null,
        filmstrip: null,
        filmstripTrack: null,
        loadingSentinel: null,
        bigPictureToggle: null,
        slideshowToggle: null
    };

    // ==========================================================================
    // Initialization
    // ==========================================================================

    function initApp() {
        if (!galleryData) {
            console.error('Gallery data not loaded');
            return;
        }

        // Populate state from loaded data
        state.photos = galleryData.photos;
        state.albums = galleryData.albums;
        state.site = galleryData.site;

        // Create grid order: indices sorted by hashed-hash for visual variety
        state.gridOrder = state.photos
            .map(function(photo, index) { return { index: index, sortKey: simpleHash(photo.hash) }; })
            .sort(function(a, b) { return a.sortKey - b.sortKey; })
            .map(function(item) { return item.index; });

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
        dom.viewerImageNext = document.getElementById('viewer-image-next');
        dom.viewerImageContainer = dom.viewerImage ? dom.viewerImage.parentElement : null;
        dom.viewerClose = document.getElementById('viewer-close');
        dom.viewerPrev = document.getElementById('viewer-prev');
        dom.viewerNext = document.getElementById('viewer-next');
        dom.infoDrawer = document.getElementById('info-drawer');
        dom.drawerToggle = document.getElementById('drawer-toggle');
        dom.drawerContent = document.getElementById('drawer-content');
        dom.filmstrip = document.getElementById('filmstrip');
        dom.bigPictureToggle = document.getElementById('big-picture-toggle');
        dom.slideshowToggle = document.getElementById('slideshow-toggle');
    }

    // ==========================================================================
    // Grid - Progressive Loading
    // ==========================================================================

    function getTileSizeClass(hash) {
        var value = parseInt(hash.substring(0, 2), 16);
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

        var startIndex = state.gridLoadedCount;
        var endIndex = Math.min(startIndex + GRID_BATCH_SIZE, state.gridOrder.length);
        var fragment = document.createDocumentFragment();
        var newTiles = [];

        for (var i = startIndex; i < endIndex; i++) {
            var photoIndex = state.gridOrder[i];
            var photo = state.photos[photoIndex];
            var tile = createTile(photo, photoIndex);
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
        var sizeClass = getTileSizeClass(photo.hash);

        var tile = document.createElement('div');
        tile.className = 'photo-tile ' + sizeClass;
        tile.dataset.index = index;
        tile.dataset.stem = photo.stem;

        var img = document.createElement('img');
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
        var totalWidth = state.photos.length * FILMSTRIP_THUMB_WIDTH;
        dom.filmstripTrack.style.width = totalWidth + 'px';

        dom.filmstrip.appendChild(dom.filmstripTrack);

        // Listen for scroll to update visible range
        dom.filmstrip.addEventListener('scroll', updateFilmstripVisibleRange, { passive: true });
    }

    function updateFilmstripVisibleRange() {
        var scrollLeft = dom.filmstrip.scrollLeft;
        var viewportWidth = dom.filmstrip.clientWidth;

        // Calculate visible range with buffer
        var startIndex = Math.max(0, Math.floor(scrollLeft / FILMSTRIP_THUMB_WIDTH) - FILMSTRIP_BUFFER);
        var endIndex = Math.min(
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

        var fragment = document.createDocumentFragment();

        for (var i = start; i < end; i++) {
            var photo = state.photos[i];

            var thumb = document.createElement('div');
            thumb.className = 'filmstrip-thumb' + (i === state.currentPhotoIndex ? ' active' : '');
            thumb.dataset.index = i;
            thumb.style.cssText = 'position:absolute;left:' + (i * FILMSTRIP_THUMB_WIDTH) + 'px;';

            var img = document.createElement('img');
            // Use micro thumbnails for filmstrip (smaller, faster loading)
            // Low priority so main image loads first
            img.src = photo.microThumbPath;
            img.alt = photo.stem;
            img.fetchPriority = 'low';

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
        var targetScroll = (state.currentPhotoIndex * FILMSTRIP_THUMB_WIDTH) -
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

        var isFirstOpen = state.currentPhotoIndex < 0;
        state.currentPhotoIndex = index;
        var photo = state.photos[index];

        // Increment navigation generation to invalidate stale callbacks
        state.navigationGen++;
        var thisGen = state.navigationGen;

        window.location.hash = '/photo/' + encodeURIComponent(photo.stem);

        dom.viewer.hidden = false;
        document.body.classList.add('viewer-open');

        // Determine which image element is currently active
        var currentImg = dom.viewerImage.classList.contains('active') ? dom.viewerImage : dom.viewerImageNext;
        var nextImg = currentImg === dom.viewerImage ? dom.viewerImageNext : dom.viewerImage;

        // Helper to update filmstrip after main image starts loading
        var filmstripUpdated = false;
        function updateFilmstripDeferred() {
            if (filmstripUpdated) return;
            filmstripUpdated = true;
            updateFilmstripVisibleRange();
            updateFilmstrip();
        }

        // Use crossfade only in big picture mode for photo-to-photo transitions
        var useCrossfade = state.bigPictureMode && !isFirstOpen && dom.viewerImageContainer;

        if (useCrossfade) {
            dom.viewerImageContainer.classList.add('crossfade');
        } else if (dom.viewerImageContainer) {
            dom.viewerImageContainer.classList.remove('crossfade');
        }

        // Set aspect ratio so thumbnail scales to full image size
        var aspectRatio = photo.width + ' / ' + photo.height;
        currentImg.style.aspectRatio = aspectRatio;
        nextImg.style.aspectRatio = aspectRatio;

        // Track loading state
        var thumbLoaded = false;
        var fullLoaded = false;

        if (useCrossfade) {
            // Big picture mode: crossfade between photos
            dom.viewerImageContainer.classList.remove('loading');

            var preload = new Image();
            preload.fetchPriority = 'high';
            preload.onload = function() {
                if (state.navigationGen !== thisGen) return;

                nextImg.src = photo.imagePath;
                nextImg.alt = photo.stem;
                updateFilmstripDeferred();

                if (nextImg.complete) {
                    currentImg.classList.remove('active');
                    nextImg.classList.add('active');
                } else {
                    nextImg.onload = function() {
                        nextImg.onload = null;
                        if (state.navigationGen !== thisGen) return;
                        currentImg.classList.remove('active');
                        nextImg.classList.add('active');
                    };
                }
            };
            preload.onerror = function() {
                if (state.navigationGen !== thisGen) return;
                nextImg.src = photo.imagePath;
                nextImg.alt = photo.stem;
                currentImg.classList.remove('active');
                nextImg.classList.add('active');
                updateFilmstripDeferred();
            };
            preload.src = photo.imagePath;
        } else {
            // Normal mode: show thumb immediately, snap to full when ready
            // Use a single image element - no crossfade for thumb -> full

            // Step 1: Show thumbnail immediately (usually cached from grid)
            var thumbImg = new Image();
            thumbImg.onload = function() {
                if (state.navigationGen !== thisGen) return;
                thumbLoaded = true;

                // If full image already loaded, skip showing thumb
                if (fullLoaded) return;

                // Show thumbnail
                dom.viewerImage.src = photo.thumbPath;
                dom.viewerImage.alt = photo.stem;
                dom.viewerImage.classList.add('active');
                if (dom.viewerImageNext) {
                    dom.viewerImageNext.classList.remove('active');
                }

                if (dom.viewerImageContainer) {
                    dom.viewerImageContainer.classList.remove('loading');
                }
            };
            thumbImg.src = photo.thumbPath;

            // Step 2: Load full image, snap to it when ready (no crossfade)
            var fullImg = new Image();
            fullImg.fetchPriority = 'high';
            fullImg.onload = function() {
                if (state.navigationGen !== thisGen) return;
                fullLoaded = true;

                // Just swap src on same element - instant snap, no crossfade
                dom.viewerImage.src = photo.imagePath;
                dom.viewerImage.alt = photo.stem;
                dom.viewerImage.classList.add('active');
                if (dom.viewerImageNext) {
                    dom.viewerImageNext.classList.remove('active');
                }

                updateFilmstripDeferred();

                if (dom.viewerImageContainer) {
                    dom.viewerImageContainer.classList.remove('loading');
                }
            };
            fullImg.onerror = function() {
                if (state.navigationGen !== thisGen) return;
                updateFilmstripDeferred();
                if (dom.viewerImageContainer) {
                    dom.viewerImageContainer.classList.remove('loading');
                }
            };
            fullImg.src = photo.imagePath;

            // If neither loads quickly, show spinner
            setTimeout(function() {
                if (state.navigationGen !== thisGen) return;
                if (!thumbLoaded && !fullLoaded && dom.viewerImageContainer) {
                    dom.viewerImageContainer.classList.add('loading');
                }
            }, 100);
        }

        updateNavButtons();
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
        // Exit big picture mode if active
        if (state.bigPictureMode) {
            exitBigPictureMode();
        }

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
        // Debounce rapid navigation inputs
        var now = Date.now();
        if (now - state.lastNavigationTime < NAVIGATION_DEBOUNCE) {
            return;
        }
        state.lastNavigationTime = now;

        var newIndex = state.currentPhotoIndex + direction;
        if (newIndex >= 0 && newIndex < state.photos.length) {
            openViewer(newIndex);
            // Reset slideshow timer if playing (so manual nav doesn't cause jarring jump)
            if (state.slideshowPlaying) {
                scheduleSlideshowAdvance();
            }
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
    // Big Picture / Slideshow Mode
    // ==========================================================================

    function enterBigPictureMode() {
        state.bigPictureMode = true;
        dom.viewer.classList.add('big-picture-mode');

        // Close drawer if open
        if (state.drawerOpen) {
            state.drawerOpen = false;
            dom.viewer.classList.remove('drawer-open');
            dom.drawerToggle.classList.remove('active');
        }

        // Request fullscreen on desktop
        if (document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen().catch(function() {
                // Fullscreen not available, continue anyway
            });
        }

        showControlsTemporarily();
        setupBigPictureModeListeners();
    }

    function exitBigPictureMode() {
        state.bigPictureMode = false;
        stopSlideshow();
        dom.viewer.classList.remove('big-picture-mode');
        dom.viewer.classList.remove('controls-visible');

        // Remove crossfade mode
        if (dom.viewerImageContainer) {
            dom.viewerImageContainer.classList.remove('crossfade');
        }

        if (document.fullscreenElement) {
            document.exitFullscreen();
        }

        clearTimeout(state.controlsTimeout);
        removeBigPictureModeListeners();
    }

    function showControlsTemporarily() {
        dom.viewer.classList.add('controls-visible');

        clearTimeout(state.controlsTimeout);
        state.controlsTimeout = setTimeout(function() {
            if (state.bigPictureMode) {
                dom.viewer.classList.remove('controls-visible');
            }
        }, CONTROLS_HIDE_DELAY);
    }

    function setupBigPictureModeListeners() {
        dom.viewer.addEventListener('mousemove', showControlsTemporarily);
        document.addEventListener('fullscreenchange', handleFullscreenChange);
    }

    function removeBigPictureModeListeners() {
        dom.viewer.removeEventListener('mousemove', showControlsTemporarily);
        document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }

    function handleFullscreenChange() {
        // If user exits fullscreen via browser, also exit big picture mode
        if (!document.fullscreenElement && state.bigPictureMode) {
            exitBigPictureMode();
        }
    }

    function toggleBigPictureMode() {
        if (state.bigPictureMode) {
            exitBigPictureMode();
        } else {
            enterBigPictureMode();
        }
    }

    // Slideshow auto-advance (uses timeout, not interval, so we can reset on manual nav)
    function startSlideshow() {
        state.slideshowPlaying = true;
        if (dom.slideshowToggle) {
            dom.slideshowToggle.classList.add('playing');
            dom.slideshowToggle.innerHTML = '&#9208;'; // Pause icon
            dom.slideshowToggle.setAttribute('aria-label', 'Pause slideshow');
        }

        scheduleSlideshowAdvance();
    }

    function scheduleSlideshowAdvance() {
        // Clear any existing timeout
        if (state.slideshowInterval) {
            clearTimeout(state.slideshowInterval);
        }

        state.slideshowInterval = setTimeout(function() {
            if (state.slideshowPlaying && state.currentPhotoIndex < state.photos.length - 1) {
                navigatePhoto(1);
                scheduleSlideshowAdvance(); // Schedule next advance
            } else if (state.slideshowPlaying) {
                // Reached end, stop slideshow
                stopSlideshow();
            }
        }, SLIDESHOW_DELAY);
    }

    function stopSlideshow() {
        state.slideshowPlaying = false;
        if (dom.slideshowToggle) {
            dom.slideshowToggle.classList.remove('playing');
            dom.slideshowToggle.innerHTML = '&#9654;'; // Play icon
            dom.slideshowToggle.setAttribute('aria-label', 'Play slideshow');
        }

        if (state.slideshowInterval) {
            clearTimeout(state.slideshowInterval);
            state.slideshowInterval = null;
        }
    }

    function toggleSlideshow() {
        if (state.slideshowPlaying) {
            stopSlideshow();
        } else {
            startSlideshow();
        }
    }

    // ==========================================================================
    // Touch / Swipe Navigation
    // ==========================================================================

    function handleTouchStart(e) {
        if (state.currentPhotoIndex < 0) return;

        touchState.startX = e.touches[0].clientX;
        touchState.startY = e.touches[0].clientY;
        touchState.startTime = Date.now();

        // In big picture mode, any touch shows controls temporarily
        if (state.bigPictureMode) {
            showControlsTemporarily();
        }
    }

    function handleTouchMove(e) {
        if (state.currentPhotoIndex < 0) return;

        var deltaX = e.touches[0].clientX - touchState.startX;
        var deltaY = e.touches[0].clientY - touchState.startY;

        // If swiping more horizontally than vertically, prevent default
        // This helps prevent browser back gesture
        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 10) {
            e.preventDefault();
        }
    }

    function handleTouchEnd(e) {
        if (state.currentPhotoIndex < 0) return;

        var deltaX = e.changedTouches[0].clientX - touchState.startX;
        var deltaY = e.changedTouches[0].clientY - touchState.startY;
        var deltaTime = Date.now() - touchState.startTime;

        // Check if it's a valid swipe
        if (deltaTime < SWIPE_TIME_LIMIT &&
            Math.abs(deltaX) > SWIPE_THRESHOLD &&
            Math.abs(deltaX) > Math.abs(deltaY)) {

            if (deltaX > 0) {
                navigatePhoto(-1); // Swipe right = previous
            } else {
                navigatePhoto(1);  // Swipe left = next
            }
        }
    }

    // ==========================================================================
    // Info Drawer
    // ==========================================================================

    function toggleDrawer() {
        state.drawerOpen = !state.drawerOpen;
        dom.viewer.classList.toggle('drawer-open', state.drawerOpen);
        dom.drawerToggle.classList.toggle('active', state.drawerOpen);

        if (state.drawerOpen && state.currentPhotoIndex >= 0) {
            var photo = state.photos[state.currentPhotoIndex];
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
        var meta = photo.metadata;
        var html = '';

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
            var exp = meta.exposure;
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
        var div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ==========================================================================
    // Map (Leaflet)
    // ==========================================================================

    function initMap(gps) {
        var mapContainer = document.getElementById('map');
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
        var hash = window.location.hash.slice(1);

        if (!hash) {
            if (state.currentPhotoIndex >= 0) {
                closeViewer();
            }
            return;
        }

        var photoMatch = hash.match(/^\/photo\/(.+)$/);
        if (photoMatch) {
            var stem = decodeURIComponent(photoMatch[1]);
            var index = -1;
            for (var i = 0; i < state.photos.length; i++) {
                if (state.photos[i].stem === stem) {
                    index = i;
                    break;
                }
            }
            if (index >= 0 && index !== state.currentPhotoIndex) {
                openViewer(index);
            }
            return;
        }

        var albumMatch = hash.match(/^\/album\/(.+)$/);
        if (albumMatch) {
            var slug = decodeURIComponent(albumMatch[1]);
            filterByAlbum(slug);
            return;
        }
    }

    function filterByAlbum(slug) {
        state.filterAlbum = slug;
        var links = document.querySelectorAll('.album-link');
        for (var i = 0; i < links.length; i++) {
            links[i].classList.toggle('active', links[i].dataset.album === slug);
        }
    }

    // ==========================================================================
    // Event Listeners
    // ==========================================================================

    function setupEventListeners() {
        dom.grid.addEventListener('click', function(e) {
            var tile = e.target.closest('.photo-tile');
            if (tile) {
                var index = parseInt(tile.dataset.index, 10);
                openViewer(index);
            }
        });

        dom.viewerClose.addEventListener('click', closeViewer);
        dom.viewerBackdrop.addEventListener('click', closeViewer);
        dom.viewerPrev.addEventListener('click', function() { navigatePhoto(-1); });
        dom.viewerNext.addEventListener('click', function() { navigatePhoto(1); });
        dom.drawerToggle.addEventListener('click', toggleDrawer);

        // Big picture mode and slideshow controls
        if (dom.bigPictureToggle) {
            dom.bigPictureToggle.addEventListener('click', toggleBigPictureMode);
        }
        if (dom.slideshowToggle) {
            dom.slideshowToggle.addEventListener('click', toggleSlideshow);
        }

        dom.filmstrip.addEventListener('click', function(e) {
            var thumb = e.target.closest('.filmstrip-thumb');
            if (thumb) {
                var index = parseInt(thumb.dataset.index, 10);
                openViewer(index);
            }
        });

        // Touch events for swipe navigation
        dom.viewer.addEventListener('touchstart', handleTouchStart, { passive: true });
        dom.viewer.addEventListener('touchmove', handleTouchMove, { passive: false });
        dom.viewer.addEventListener('touchend', handleTouchEnd, { passive: true });

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
                if (!state.bigPictureMode) {
                    toggleDrawer();
                }
                break;
            case 'f':
            case 'F':
                e.preventDefault();
                toggleBigPictureMode();
                break;
            case ' ': // Spacebar
                if (state.bigPictureMode) {
                    e.preventDefault();
                    toggleSlideshow();
                }
                break;
            case 'Escape':
                e.preventDefault();
                if (state.bigPictureMode) {
                    exitBigPictureMode();
                } else if (state.drawerOpen) {
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

    function start() {
        // Show loading state
        document.body.classList.add('loading');

        loadData().then(function() {
            document.body.classList.remove('loading');
            initApp();
        }).catch(function(err) {
            console.error('Failed to load gallery data:', err);
            document.body.classList.remove('loading');
            document.body.classList.add('error');
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }

})();
