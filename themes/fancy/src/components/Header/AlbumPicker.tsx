// Album picker with collapsible tree dropdown

import { useState, useRef, useEffect, useCallback, useMemo } from 'preact/hooks';
import { useGalleryStore } from '../../store/galleryStore';
import { useTranslation } from '../../context/I18nContext';
import type { Album } from '../../types';

interface AlbumNode {
  album: Album;
  children: AlbumNode[];
  depth: number;
}

function buildAlbumTree(albums: Album[]): AlbumNode[] {
  // Sort by path to ensure parents come before children
  const sorted = [...albums].sort((a, b) => a.path.localeCompare(b.path));

  const root: AlbumNode[] = [];
  const nodeMap = new Map<string, AlbumNode>();

  for (const album of sorted) {
    const node: AlbumNode = { album, children: [], depth: 0 };
    nodeMap.set(album.path, node);

    // Find parent by checking if any existing node's path is a prefix
    const lastSlash = album.path.lastIndexOf('/');
    const parentPath = lastSlash > 0 ? album.path.substring(0, lastSlash) : '';
    const parent = nodeMap.get(parentPath);

    if (parent) {
      node.depth = parent.depth + 1;
      parent.children.push(node);
    } else {
      root.push(node);
    }
  }

  return root;
}

export function AlbumPicker() {
  const albums = useGalleryStore((s) => s.albums);
  const filterAlbum = useGalleryStore((s) => s.filterAlbum);
  const t = useTranslation();

  const [open, setOpen] = useState(false);
  const [expandedAlbums, setExpandedAlbums] = useState<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Build album tree from flat list
  const albumTree = useMemo(() => buildAlbumTree(albums), [albums]);

  // Get current album display name
  const currentAlbumName = useMemo(() => {
    if (!filterAlbum) return t('nav.all_photos');
    const found = albums.find((a) => a.path === filterAlbum);
    return found?.name || filterAlbum;
  }, [filterAlbum, albums, t]);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Close on Escape
  useEffect(() => {
    function handleKeydown(e: KeyboardEvent) {
      if (e.key === 'Escape' && open) {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener('keydown', handleKeydown);
    return () => document.removeEventListener('keydown', handleKeydown);
  }, [open]);

  // Close on scroll (for mobile)
  useEffect(() => {
    function handleScroll() {
      if (open) setOpen(false);
    }

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [open]);

  const handleToggle = useCallback((e: MouseEvent) => {
    e.stopPropagation();
    setOpen((prev) => !prev);
  }, []);

  const handleAllPhotos = useCallback(() => {
    setOpen(false);
    setExpandedAlbums(new Set());
    // Just set hash - let the hash router handle state update
    window.location.hash = '';
  }, []);

  const handleAlbumClick = useCallback(
    (album: Album, hasChildren: boolean) => {
      const isExpanded = expandedAlbums.has(album.path);

      if (hasChildren && !isExpanded) {
        // Expand this album
        setExpandedAlbums((prev) => new Set([...prev, album.path]));
      } else {
        // Filter to this album
        setOpen(false);
        setExpandedAlbums(new Set());
        // Just set hash - let the hash router handle state update
        window.location.hash = '/album/' + encodeURIComponent(album.path);
      }
    },
    [expandedAlbums]
  );

  // Render a single album node and its children
  const renderAlbumNode = useCallback(
    (node: AlbumNode): preact.JSX.Element[] => {
      const { album, children, depth } = node;
      const hasChildren = children.length > 0;
      const isExpanded = expandedAlbums.has(album.path);
      const isActive = filterAlbum === album.path;

      const items: preact.JSX.Element[] = [];

      items.push(
        <button
          key={album.path}
          class={`album-dropdown-item${isActive ? ' active' : ''}`}
          data-depth={depth}
          role="menuitem"
          onClick={() => handleAlbumClick(album, hasChildren)}
        >
          {hasChildren ? (
            <svg
              class={`album-dropdown-chevron${isExpanded ? ' expanded' : ''}`}
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
            >
              <path
                d="M4.5 2.5L8 6L4.5 9.5"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          ) : (
            <span class="album-dropdown-spacer" />
          )}
          <span class="album-dropdown-name">{album.name}</span>
        </button>
      );

      // Render children if expanded
      if (isExpanded) {
        for (const child of children) {
          items.push(...renderAlbumNode(child));
        }
      }

      return items;
    },
    [expandedAlbums, filterAlbum, handleAlbumClick]
  );

  return (
    <div
      ref={containerRef}
      class={`album-dropdown${open ? ' open' : ''}`}
    >
      <button
        ref={triggerRef}
        class="album-dropdown-trigger"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={handleToggle}
      >
        <span class="album-dropdown-current">{currentAlbumName}</span>
        <svg
          class="album-dropdown-arrow"
          width="10"
          height="6"
          viewBox="0 0 10 6"
          fill="none"
        >
          <path
            d="M1 1L5 5L9 1"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </button>
      <div class="album-dropdown-menu" role="menu">
        <button
          class={`album-dropdown-item album-dropdown-all${!filterAlbum ? ' active' : ''}`}
          role="menuitem"
          onClick={handleAllPhotos}
        >
          <span class="album-dropdown-spacer" />
          <span class="album-dropdown-name">{t('nav.all_photos')}</span>
        </button>
        {albumTree.map((node) => renderAlbumNode(node))}
      </div>
    </div>
  );
}
