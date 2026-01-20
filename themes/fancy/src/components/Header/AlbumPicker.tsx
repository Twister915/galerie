// Album picker with collapsible tree dropdown

import { useState, useCallback, useMemo } from 'preact/hooks';
import { useGalleryStore } from '../../store/galleryStore';
import { useTranslation } from '../../context/I18nContext';
import { useDropdown } from '../../hooks';
import { Button, ChevronDownIcon, ChevronRightIcon } from '../UI';
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

  const [expandedAlbums, setExpandedAlbums] = useState<Set<string>>(new Set());

  const { open, containerRef, triggerRef, handleTriggerClick, close } =
    useDropdown({
      id: 'album-picker',
      onClose: () => setExpandedAlbums(new Set()),
    });

  // Build album tree from flat list
  const albumTree = useMemo(() => buildAlbumTree(albums), [albums]);

  // Get current album display name
  const currentAlbumName = useMemo(() => {
    if (!filterAlbum) return t('nav.all_photos');
    const found = albums.find((a) => a.path === filterAlbum);
    return found?.name || filterAlbum;
  }, [filterAlbum, albums, t]);

  const handleAllPhotos = useCallback(() => {
    close();
    // Just set hash - let the hash router handle state update
    window.location.hash = '';
  }, [close]);

  const handleAlbumClick = useCallback(
    (album: Album, hasChildren: boolean) => {
      const isExpanded = expandedAlbums.has(album.path);

      if (hasChildren && !isExpanded) {
        // Expand this album
        setExpandedAlbums((prev) => new Set([...prev, album.path]));
      } else {
        // Filter to this album
        close();
        // Just set hash - let the hash router handle state update
        window.location.hash = '/album/' + encodeURIComponent(album.path);
      }
    },
    [expandedAlbums, close]
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
        <Button
          key={album.path}
          variant="menu-item"
          active={isActive}
          class="album-dropdown-item"
          data-depth={depth}
          role="menuitem"
          onClick={() => handleAlbumClick(album, hasChildren)}
        >
          {hasChildren ? (
            <ChevronRightIcon
              class={`album-dropdown-chevron${isExpanded ? ' expanded' : ''}`}
            />
          ) : (
            <span class="album-dropdown-spacer" />
          )}
          <span class="album-dropdown-name">{album.name}</span>
        </Button>
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
      <Button
        ref={triggerRef}
        open={open}
        class="album-dropdown-trigger"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={handleTriggerClick}
      >
        <span class="album-dropdown-current">{currentAlbumName}</span>
        <ChevronDownIcon class="btn__arrow" />
      </Button>
      <div class="album-dropdown-menu" role="menu">
        <Button
          variant="menu-item"
          active={!filterAlbum}
          class="album-dropdown-item album-dropdown-all"
          role="menuitem"
          onClick={handleAllPhotos}
        >
          <span class="album-dropdown-spacer" />
          <span class="album-dropdown-name">{t('nav.all_photos')}</span>
        </Button>
        {albumTree.map((node) => renderAlbumNode(node))}
      </div>
    </div>
  );
}
