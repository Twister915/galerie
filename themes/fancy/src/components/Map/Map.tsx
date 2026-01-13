// Leaflet map integration (lazy loaded)

import { useEffect, useRef } from 'preact/hooks';
import type { GpsData, L } from '../../types';

interface MapViewProps {
  gps: GpsData;
}

export function MapView({ gps }: MapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  useEffect(() => {
    const container = mapRef.current;
    if (!container) return;
    if (gps.latitude === null || gps.longitude === null) return;

    // Clean up previous map instance
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const L = window.L;
    if (!L) return;

    const map = L.map(container, {
      zoomControl: false,
      attributionControl: false,
    }).setView([gps.latitude, gps.longitude], 14);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map);

    L.marker([gps.latitude, gps.longitude]).addTo(map);

    mapInstanceRef.current = map;

    // Invalidate size after drawer animation
    const timeout = setTimeout(() => {
      map.invalidateSize();
    }, 300);

    return () => {
      clearTimeout(timeout);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [gps.latitude, gps.longitude]);

  return <div ref={mapRef} class="map-container" id="map" />;
}
