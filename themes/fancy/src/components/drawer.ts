// Info drawer component

import { state, dom } from '../state';
import { t } from '../services/i18n';
import { escapeHtml } from '../utils/dom';
import { formatBytes } from '../utils/format';
import { initMap } from './map';
import type { Photo } from '../types';

export function toggleDrawer(): void {
  state.drawerOpen = !state.drawerOpen;
  dom.viewer?.classList.toggle('drawer-open', state.drawerOpen);
  dom.drawerToggle?.classList.toggle('active', state.drawerOpen);

  if (state.drawerOpen && state.currentPhotoIndex >= 0) {
    const photo = state.photos[state.currentPhotoIndex];
    if (
      photo.metadata.gps &&
      photo.metadata.gps.latitude !== null &&
      photo.metadata.gps.longitude !== null
    ) {
      setTimeout(() => {
        initMap(photo.metadata.gps!);
      }, 100);
    }
  } else if (!state.drawerOpen && state.map) {
    state.map.remove();
    state.map = null;
  }
}

export function updateDrawerContent(photo: Photo): void {
  if (!dom.drawerContent) return;

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
      html +=
        '<span class="meta-value">' + escapeHtml(exp.shutterSpeed) + '</span>';
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
      html +=
        '<span class="meta-value">' + escapeHtml(exp.focalLength) + '</span>';
      html += '</div>';
    }
    html += '</div>';
  }

  if (meta.gps) {
    html += '<div class="meta-section">';
    html += '<h3>' + t('section.location') + '</h3>';
    if (meta.gps.city) {
      const locationParts = [meta.gps.city];
      if (meta.gps.region) locationParts.push(meta.gps.region);
      html += '<div class="meta-item">';
      html += '<span class="meta-label">' + t('field.place') + '</span>';
      html +=
        '<span class="meta-value">' +
        escapeHtml(locationParts.join(', ')) +
        '</span>';
      html += '</div>';
    }
    if (meta.gps.country) {
      const countryName = meta.gps.countryCode
        ? t('country.' + meta.gps.countryCode) !==
          'country.' + meta.gps.countryCode
          ? t('country.' + meta.gps.countryCode)
          : meta.gps.country
        : meta.gps.country;
      html += '<div class="meta-item">';
      html += '<span class="meta-label">' + t('field.country') + '</span>';
      html +=
        '<span class="meta-value">' +
        (meta.gps.flag || '') +
        ' ' +
        escapeHtml(countryName) +
        '</span>';
      html += '</div>';
    }
    if (meta.gps.display !== null) {
      html += '<div class="meta-item">';
      html += '<span class="meta-label">' + t('field.coordinates') + '</span>';
      html +=
        '<span class="meta-value">' + escapeHtml(meta.gps.display) + '</span>';
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

  html +=
    '<a href="' +
    photo.originalPath +
    '" class="download-link" download>';
  html += t('action.download') + ' (' + formatBytes(photo.originalSize) + ')';
  html += '</a>';

  dom.drawerContent.innerHTML = html;
}
