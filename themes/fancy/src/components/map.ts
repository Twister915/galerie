// Leaflet map integration

import { state } from '../state';
import type { GpsData } from '../types';

export function initMap(gps: GpsData): void {
  const mapContainer = document.getElementById('map');
  if (!mapContainer) return;

  if (gps.latitude === null || gps.longitude === null) return;

  if (state.map) {
    state.map.remove();
  }

  const L = window.L;

  state.map = L.map('map', {
    zoomControl: false,
    attributionControl: false,
  }).setView([gps.latitude, gps.longitude], 14);

  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
  }).addTo(state.map);

  L.marker([gps.latitude, gps.longitude]).addTo(state.map);

  setTimeout(() => {
    if (state.map) {
      state.map.invalidateSize();
    }
  }, 300);
}
