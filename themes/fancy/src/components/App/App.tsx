// Main application component

import { useEffect, useState } from 'preact/hooks';
import { I18nProvider } from '../../context/I18nContext';
import { useGalleryStore } from '../../store/galleryStore';
import { useHashRouter } from '../../hooks/useHashRouter';
import { useKeyboardNav } from '../../hooks/useKeyboardNav';
import { Header } from '../Header';
import { Grid } from '../Grid';
import { Footer } from '../Footer';
import { Viewer } from '../Viewer';
import type { GalleryData } from '../../types';

// Data loading
async function loadGalleryData(): Promise<GalleryData> {
  const cacheKey = 'galerie-gallery-' + GALLERY_URL;

  // Try cache first
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch {
    // localStorage not available
  }

  // Fetch from network
  const response = await fetch(GALLERY_URL);
  const data = await response.json();

  // Cache the result
  try {
    localStorage.setItem(cacheKey, JSON.stringify(data));
  } catch {
    // localStorage full or not available
  }

  return data;
}

function AppContent() {
  // Initialize hooks
  useHashRouter();
  useKeyboardNav();

  return (
    <>
      <Header />
      <Grid />
      <Footer />
      <Viewer />
    </>
  );
}

export function App() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const setGalleryData = useGalleryStore((s) => s.setGalleryData);

  useEffect(() => {
    document.body.classList.add('loading');

    loadGalleryData()
      .then((data) => {
        setGalleryData(data.photos, data.albums, data.site);
        document.body.classList.remove('loading');
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load gallery data:', err);
        document.body.classList.remove('loading');
        document.body.classList.add('error');
        setError('Failed to load gallery data');
        setLoading(false);
      });
  }, [setGalleryData]);

  if (error) {
    return <div class="error-message">{error}</div>;
  }

  if (loading) {
    return null; // Loading indicator handled by body.loading class
  }

  return (
    <I18nProvider>
      <AppContent />
    </I18nProvider>
  );
}
