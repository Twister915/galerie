// Site header with album navigation and language picker

import { useEffect, useRef, useState } from 'preact/hooks';
import { useGalleryStore } from '../../store/galleryStore';
import { AlbumPicker } from './AlbumPicker';
import { LangPicker } from './LangPicker';
import { ThemeToggle } from './ThemeToggle';

export function Header() {
  const albums = useGalleryStore((s) => s.albums);
  const site = useGalleryStore((s) => s.site);
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

  return (
    <header
      ref={headerRef}
      class={`site-header${hidden ? ' hidden' : ''}`}
    >
      <a href="/" class="site-title">
        {site.title}
      </a>

      {albums.length > 0 && <AlbumPicker />}

      <div class="header-controls">
        <ThemeToggle />
        {I18N_CONFIG.languages.length > 1 && <LangPicker />}
      </div>
    </header>
  );
}
