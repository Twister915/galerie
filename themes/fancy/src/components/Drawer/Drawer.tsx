// Info drawer component

import { useGalleryStore, useCurrentPhoto } from '../../store/galleryStore';
import { useTranslation, useDateFormatter } from '../../context/I18nContext';
import { MetaSection } from './MetaSection';
import { DownloadLink } from './DownloadLink';
import { MapView } from '../Map/Map';

export function Drawer() {
  const drawerOpen = useGalleryStore((s) => s.drawerOpen);
  const photo = useCurrentPhoto();
  const t = useTranslation();
  const formatDate = useDateFormatter();

  if (!photo) return null;

  const meta = photo.metadata;

  return (
    <aside class="info-drawer" id="info-drawer">
      <div class="drawer-content" id="drawer-content">
        {/* Photo name section */}
        <MetaSection title={t('section.photo')}>
          <MetaItem label={t('field.name')} value={photo.stem} />
          {meta.rating !== undefined && meta.rating > 0 && (
            <MetaItem label={t('field.rating')} value={renderStars(meta.rating)} />
          )}
          <MetaItem
            label={t('field.dimensions')}
            value={`${photo.width} × ${photo.height}`}
          />
          <MetaItem
            label={t('field.megapixels')}
            value={formatMegapixels(photo.width, photo.height)}
          />
        </MetaSection>

        {/* Date section */}
        {meta.dateTaken && (
          <MetaSection title={t('section.date')}>
            <MetaItem label={t('field.taken')} value={formatDate(meta.dateTaken)} />
          </MetaSection>
        )}

        {/* Camera section */}
        {(meta.camera || meta.lens) && (
          <MetaSection title={t('section.camera')}>
            {meta.camera && (
              <MetaItem label={t('field.camera')} value={meta.camera} />
            )}
            {meta.lens && <MetaItem label={t('field.lens')} value={meta.lens} />}
          </MetaSection>
        )}

        {/* Exposure section */}
        {meta.exposure && (
          <MetaSection title={t('section.exposure')}>
            {meta.exposure.aperture && (
              <MetaItem
                label={t('field.aperture')}
                value={meta.exposure.aperture}
              />
            )}
            {meta.exposure.shutterSpeed && (
              <MetaItem
                label={t('field.shutter')}
                value={meta.exposure.shutterSpeed}
              />
            )}
            {meta.exposure.iso && (
              <MetaItem label={t('field.iso')} value={String(meta.exposure.iso)} />
            )}
            {meta.exposure.focalLength && (
              <MetaItem
                label={t('field.focal_length')}
                value={meta.exposure.focalLength}
              />
            )}
            {meta.exposure.program && (
              <MetaItem
                label={t('field.program')}
                value={t(meta.exposure.program)}
              />
            )}
          </MetaSection>
        )}

        {/* Location section */}
        {meta.gps && (
          <MetaSection title={t('section.location')}>
            {meta.gps.city && (
              <MetaItem
                label={t('field.place')}
                value={[meta.gps.city, meta.gps.region]
                  .filter(Boolean)
                  .join(', ')}
              />
            )}
            {meta.gps.country && (
              <MetaItem
                label={t('field.country')}
                value={`${meta.gps.flag || ''} ${getCountryName(meta.gps.countryCode, meta.gps.country, t)}`.trim()}
              />
            )}
            {meta.gps.display !== null && (
              <>
                <MetaItem
                  label={t('field.coordinates')}
                  value={meta.gps.display}
                />
                {drawerOpen &&
                  meta.gps.latitude !== null &&
                  meta.gps.longitude !== null && <MapView gps={meta.gps} />}
              </>
            )}
          </MetaSection>
        )}

        {/* Copyright section */}
        {meta.copyright && (
          <MetaSection title={t('section.copyright')}>
            <div class="meta-item">
              <span class="meta-value">{meta.copyright}</span>
            </div>
          </MetaSection>
        )}

        {/* Download link */}
        <DownloadLink
          href={photo.originalPath}
          size={photo.originalSize}
          label={t('action.download')}
        />
      </div>
    </aside>
  );
}

// Helper to get country name with i18n fallback
function getCountryName(
  countryCode: string | undefined,
  fallback: string,
  t: (key: string) => string
): string {
  if (!countryCode) return fallback;
  const translated = t('country.' + countryCode);
  return translated !== 'country.' + countryCode ? translated : fallback;
}

// Meta item component
interface MetaItemProps {
  label: string;
  value: string;
}

function MetaItem({ label, value }: MetaItemProps) {
  return (
    <div class="meta-item">
      <span class="meta-label">{label}</span>
      <span class="meta-value">{value}</span>
    </div>
  );
}

// Render star rating (1-5 stars)
function renderStars(rating: number): string {
  const filled = Math.min(Math.max(Math.round(rating), 0), 5);
  return '★'.repeat(filled) + '☆'.repeat(5 - filled);
}

// Format megapixels from width and height
function formatMegapixels(width: number, height: number): string {
  const mp = (width * height) / 1_000_000;
  return mp >= 10 ? `${Math.round(mp)} MP` : `${mp.toFixed(1)} MP`;
}
