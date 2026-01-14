// Site header with album navigation and language picker

import { useEffect, useRef, useState } from 'preact/hooks';
import { useGalleryStore } from '../../store/galleryStore';
import { LangPicker } from './LangPicker';

export function Header() {
  const albums = useGalleryStore((s) => s.albums);
  const site = useGalleryStore((s) => s.site);
  const filterAlbum = useGalleryStore((s) => s.filterAlbum);
  const setFilterAlbum = useGalleryStore((s) => s.setFilterAlbum);
  const headerRef = useRef<HTMLElement>(null);
  const [hidden, setHidden] = useState(false);

  // Hide header on scroll down
  useEffect(() => {
    let lastScrollY = 0;

    function handleScroll() {
      const currentScrollY = window.scrollY;
      if (currentScrollY > lastScrollY && currentScrollY > 60) {
        setHidden(true);
      } else {
        setHidden(false);
      }
      lastScrollY = currentScrollY;
    }

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  function handleAlbumClick(e: MouseEvent, slug: string) {
    e.preventDefault();
    window.location.hash = '/album/' + slug;
    setFilterAlbum(slug);
  }

  return (
    <header
      ref={headerRef}
      class={`site-header${hidden ? ' hidden' : ''}`}
    >
      <a href="/" class="site-title">
        {site.title}
      </a>

      {albums.length > 0 && (
        <nav class="album-nav">
          {albums.map((album) => (
            <a
              key={album.slug}
              href={`#/album/${album.slug}`}
              class={`album-link${filterAlbum === album.slug ? ' active' : ''}`}
              data-album={album.slug}
              onClick={(e) => handleAlbumClick(e as MouseEvent, album.slug)}
            >
              {album.name}
            </a>
          ))}
        </nav>
      )}

      {I18N_CONFIG.languages.length > 1 && <LangPicker />}
    </header>
  );
}
