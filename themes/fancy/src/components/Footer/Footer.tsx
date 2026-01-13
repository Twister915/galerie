// Site footer

import { useTranslation } from '../../context/I18nContext';
import { useGalleryStore } from '../../store/galleryStore';

export function Footer() {
  const t = useTranslation();
  const site = useGalleryStore((s) => s.site);

  return (
    <footer class="site-footer">
      <span>{t('footer.built_with')}</span>{' '}
      <a
        href="https://github.com/Twister915/galerie"
        target="_blank"
        rel="noopener"
      >
        galerie
      </a>{' '}
      <span class="version">{site.version}</span>
      <span>{t('footer.built_with_suffix')}</span>
    </footer>
  );
}
