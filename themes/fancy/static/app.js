/**
 * Galerie Fancy Theme - Single Page Application
 *
 * Architecture:
 * - State management via a central state object
 * - Hash-based routing (#/photo/stem, #/album/slug)
 * - Components: Grid, Viewer, Filmstrip, Drawer, Map
 * - Event delegation for performance
 */

(function() {
    'use strict';

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
        filterAlbum: null
    };

    // ==========================================================================
    // Utilities
    // ==========================================================================

    /**
     * Simple string hash function for deterministic shuffling.
     * Returns a numeric hash that's different from the input's sort order.
     */
    function simpleHash(str) {
        var hash = 5381;
        for (var i = 0; i < str.length; i++) {
            hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
        }
        return hash >>> 0; // Convert to unsigned 32-bit
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
        filmstrip: null
    };

    // ==========================================================================
    // Initialization
    // ==========================================================================

    function init() {
        // Parse embedded photo data
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
            // We hash the hash again so grid order doesn't correlate with tile size
            state.gridOrder = state.photos
                .map(function(photo, index) { return { index: index, sortKey: simpleHash(photo.hash) }; })
                .sort(function(a, b) { return a.sortKey - b.sortKey; })
                .map(function(item) { return item.index; });
        } catch (e) {
            console.error('Failed to parse photo data:', e);
            return;
        }

        // Cache DOM elements
        cacheDomElements();

        // Build grid
        buildGrid();

        // Pre-build filmstrip (hidden, but ready for instant open)
        buildFilmstrip();

        // Initialize Masonry after images load
        initMasonry();

        // Set up event listeners
        setupEventListeners();

        // Handle initial route
        handleRoute();
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
    // Grid
    // ==========================================================================

    /**
     * Determine tile size class from photo hash.
     * Uses first 2 chars of hash to deterministically assign size.
     * Distribution: ~60% 1x, ~30% 2x, ~10% 4x
     */
    function getTileSizeClass(hash) {
        const value = parseInt(hash.substring(0, 2), 16);
        if (value < 25) return 'size-4x';  // ~10%
        if (value < 102) return 'size-2x'; // ~30%
        return 'size-1x';                   // ~60%
    }

    function buildGrid() {
        // Add grid-sizer and gutter-sizer for Masonry
        dom.grid.innerHTML = '<div class="grid-sizer"></div><div class="gutter-sizer"></div>';

        // Create photo tiles in shuffled order (sorted by hash for variety)
        state.gridOrder.forEach(function(index) {
            const photo = state.photos[index];
            const sizeClass = getTileSizeClass(photo.hash);

            const tile = document.createElement('div');
            tile.className = 'photo-tile ' + sizeClass;
            tile.dataset.index = index;
            tile.dataset.stem = photo.stem;

            const img = document.createElement('img');
            img.src = photo.thumbPath;
            img.alt = photo.stem;
            img.loading = 'lazy';

            // Set aspect ratio for pre-layout
            if (photo.width && photo.height) {
                img.style.aspectRatio = photo.width + ' / ' + photo.height;
            }

            tile.appendChild(img);
            dom.grid.appendChild(tile);
        });
    }

    function initMasonry() {
        // Wait for images to load before initializing Masonry
        imagesLoaded(dom.grid, function() {
            state.masonry = new Masonry(dom.grid, {
                itemSelector: '.photo-tile',
                columnWidth: '.grid-sizer',
                gutter: '.gutter-sizer',
                fitWidth: true,        // Size container to fit items
                transitionDuration: 0
            });
        });
    }

    // ==========================================================================
    // Viewer
    // ==========================================================================

    function openViewer(index) {
        if (index < 0 || index >= state.photos.length) return;

        state.currentPhotoIndex = index;
        const photo = state.photos[index];

        // Update URL
        window.location.hash = '/photo/' + encodeURIComponent(photo.stem);

        // Show viewer
        dom.viewer.hidden = false;
        document.body.classList.add('viewer-open');

        // Load image
        dom.viewerImage.src = photo.imagePath;
        dom.viewerImage.alt = photo.stem;

        // Update navigation buttons
        updateNavButtons();

        // Update filmstrip active state
        updateFilmstrip();

        // Update drawer content
        updateDrawerContent(photo);

        // Preload adjacent images
        preloadAdjacentImages(index);
    }

    function closeViewer() {
        state.currentPhotoIndex = -1;
        state.drawerOpen = false;
        dom.viewer.hidden = true;
        dom.viewer.classList.remove('drawer-open');
        dom.drawerToggle.classList.remove('active');
        document.body.classList.remove('viewer-open');
        window.location.hash = '';

        // Destroy map if exists
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
        var preloadIndices = [index - 1, index + 1];
        preloadIndices.forEach(function(i) {
            if (i >= 0 && i < state.photos.length) {
                var img = new Image();
                img.src = state.photos[i].imagePath;
            }
        });
    }

    // ==========================================================================
    // Filmstrip
    // ==========================================================================

    function buildFilmstrip() {
        dom.filmstrip.innerHTML = '';

        state.photos.forEach(function(photo, index) {
            const thumb = document.createElement('div');
            thumb.className = 'filmstrip-thumb';
            thumb.dataset.index = index;

            const img = document.createElement('img');
            img.src = photo.thumbPath;
            img.alt = photo.stem;
            img.loading = 'lazy';

            thumb.appendChild(img);
            dom.filmstrip.appendChild(thumb);
        });
    }

    function updateFilmstrip() {
        // Just update active class, don't rebuild
        var thumbs = dom.filmstrip.querySelectorAll('.filmstrip-thumb');
        for (var i = 0; i < thumbs.length; i++) {
            thumbs[i].classList.toggle('active', i === state.currentPhotoIndex);
        }
        scrollFilmstripToActive();
    }

    function scrollFilmstripToActive() {
        const activeThumb = dom.filmstrip.querySelector('.filmstrip-thumb.active');
        if (activeThumb) {
            activeThumb.scrollIntoView({
                behavior: 'smooth',
                block: 'nearest',
                inline: 'center'
            });
        }
    }

    // ==========================================================================
    // Info Drawer
    // ==========================================================================

    function toggleDrawer() {
        state.drawerOpen = !state.drawerOpen;
        dom.viewer.classList.toggle('drawer-open', state.drawerOpen);
        dom.drawerToggle.classList.toggle('active', state.drawerOpen);

        // Initialize map if opening and photo has GPS
        if (state.drawerOpen && state.currentPhotoIndex >= 0) {
            const photo = state.photos[state.currentPhotoIndex];
            if (photo.metadata.gps) {
                setTimeout(function() {
                    initMap(photo.metadata.gps);
                }, 100);
            }
        } else if (!state.drawerOpen && state.map) {
            // Destroy map when closing
            state.map.remove();
            state.map = null;
        }
    }

    function updateDrawerContent(photo) {
        const meta = photo.metadata;
        let html = '';

        // Photo name
        html += '<div class="meta-section">';
        html += '<h3>Photo</h3>';
        html += '<div class="meta-item">';
        html += '<span class="meta-label">Name</span>';
        html += '<span class="meta-value">' + escapeHtml(photo.stem) + '</span>';
        html += '</div>';
        html += '</div>';

        // Date
        if (meta.dateTaken) {
            html += '<div class="meta-section">';
            html += '<h3>Date</h3>';
            html += '<div class="meta-item">';
            html += '<span class="meta-label">Taken</span>';
            html += '<span class="meta-value">' + escapeHtml(meta.dateTaken) + '</span>';
            html += '</div>';
            html += '</div>';
        }

        // Camera info
        if (meta.camera || meta.lens) {
            html += '<div class="meta-section">';
            html += '<h3>Camera</h3>';
            if (meta.camera) {
                html += '<div class="meta-item">';
                html += '<span class="meta-label">Camera</span>';
                html += '<span class="meta-value">' + escapeHtml(meta.camera) + '</span>';
                html += '</div>';
            }
            if (meta.lens) {
                html += '<div class="meta-item">';
                html += '<span class="meta-label">Lens</span>';
                html += '<span class="meta-value">' + escapeHtml(meta.lens) + '</span>';
                html += '</div>';
            }
            html += '</div>';
        }

        // Exposure
        if (meta.exposure) {
            const exp = meta.exposure;
            html += '<div class="meta-section">';
            html += '<h3>Exposure</h3>';
            if (exp.aperture) {
                html += '<div class="meta-item">';
                html += '<span class="meta-label">Aperture</span>';
                html += '<span class="meta-value">' + escapeHtml(exp.aperture) + '</span>';
                html += '</div>';
            }
            if (exp.shutterSpeed) {
                html += '<div class="meta-item">';
                html += '<span class="meta-label">Shutter</span>';
                html += '<span class="meta-value">' + escapeHtml(exp.shutterSpeed) + '</span>';
                html += '</div>';
            }
            if (exp.iso) {
                html += '<div class="meta-item">';
                html += '<span class="meta-label">ISO</span>';
                html += '<span class="meta-value">' + exp.iso + '</span>';
                html += '</div>';
            }
            if (exp.focalLength) {
                html += '<div class="meta-item">';
                html += '<span class="meta-label">Focal Length</span>';
                html += '<span class="meta-value">' + escapeHtml(exp.focalLength) + '</span>';
                html += '</div>';
            }
            html += '</div>';
        }

        // Location
        if (meta.gps) {
            html += '<div class="meta-section">';
            html += '<h3>Location</h3>';
            html += '<div class="meta-item">';
            html += '<span class="meta-label">Coordinates</span>';
            html += '<span class="meta-value">' + meta.gps.latitude.toFixed(4) + ', ' + meta.gps.longitude.toFixed(4) + '</span>';
            html += '</div>';
            html += '<div class="map-container" id="map"></div>';
            html += '</div>';
        }

        // Copyright
        if (meta.copyright) {
            html += '<div class="meta-section">';
            html += '<h3>Copyright</h3>';
            html += '<div class="meta-item">';
            html += '<span class="meta-value">' + escapeHtml(meta.copyright) + '</span>';
            html += '</div>';
            html += '</div>';
        }

        // Download link
        html += '<a href="' + photo.originalPath + '" class="download-link" download>';
        html += 'Download Original';
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

        // Destroy existing map
        if (state.map) {
            state.map.remove();
        }

        // Create map
        state.map = L.map('map', {
            zoomControl: false,
            attributionControl: false
        }).setView([gps.latitude, gps.longitude], 14);

        // Add OpenStreetMap tiles
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19
        }).addTo(state.map);

        // Add marker
        L.marker([gps.latitude, gps.longitude]).addTo(state.map);

        // Invalidate size after drawer animation
        setTimeout(function() {
            state.map.invalidateSize();
        }, 300);
    }

    // ==========================================================================
    // Routing
    // ==========================================================================

    function handleRoute() {
        const hash = window.location.hash.slice(1); // Remove #

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
            // Skip if already viewing this photo (avoid double-processing)
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

        // Update active album link
        document.querySelectorAll('.album-link').forEach(function(link) {
            link.classList.toggle('active', link.dataset.album === slug);
        });
    }

    // ==========================================================================
    // Event Listeners
    // ==========================================================================

    function setupEventListeners() {
        // Grid clicks (event delegation)
        dom.grid.addEventListener('click', function(e) {
            const tile = e.target.closest('.photo-tile');
            if (tile) {
                const index = parseInt(tile.dataset.index, 10);
                openViewer(index);
            }
        });

        // Viewer controls
        dom.viewerClose.addEventListener('click', closeViewer);
        dom.viewerBackdrop.addEventListener('click', closeViewer);
        dom.viewerPrev.addEventListener('click', function() {
            navigatePhoto(-1);
        });
        dom.viewerNext.addEventListener('click', function() {
            navigatePhoto(1);
        });
        dom.drawerToggle.addEventListener('click', toggleDrawer);

        // Filmstrip clicks (event delegation)
        dom.filmstrip.addEventListener('click', function(e) {
            const thumb = e.target.closest('.filmstrip-thumb');
            if (thumb) {
                const index = parseInt(thumb.dataset.index, 10);
                openViewer(index);
            }
        });

        // Keyboard navigation
        document.addEventListener('keydown', handleKeydown);

        // Hash change for routing
        window.addEventListener('hashchange', handleRoute);

        // Scroll to hide/show header
        var lastScrollY = 0;
        window.addEventListener('scroll', function() {
            var currentScrollY = window.scrollY;
            if (currentScrollY > lastScrollY && currentScrollY > 60) {
                // Scrolling down & past header
                dom.header.classList.add('hidden');
            } else {
                // Scrolling up
                dom.header.classList.remove('hidden');
            }
            lastScrollY = currentScrollY;
        }, { passive: true });
    }

    function handleKeydown(e) {
        // Only handle when viewer is open
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
