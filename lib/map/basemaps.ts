import type { StyleSpecification } from 'maplibre-gl';

export type BasemapId = 'streets' | 'satellite' | 'terrain' | 'bhuvan';

export type BasemapConfig = {
  id: BasemapId;
  label: string;
  attribution: string;
  /**
   * Resolves a MapLibre style object (or URL string). MapTiler vector style
   * is fetched via URL; raster basemaps are inlined.
   */
  style: (opts: { maptilerKey?: string }) => StyleSpecification | string;
  available: (opts: { maptilerKey?: string }) => boolean;
};

const OSM_ATTRIBUTION = '© OpenStreetMap contributors';

export const basemaps: Record<BasemapId, BasemapConfig> = {
  streets: {
    id: 'streets',
    label: 'Streets',
    attribution: '© MapTiler © OpenStreetMap contributors',
    available: ({ maptilerKey }) => Boolean(maptilerKey),
    style: ({ maptilerKey }) =>
      `https://api.maptiler.com/maps/streets-v2/style.json?key=${maptilerKey}`,
  },
  satellite: {
    id: 'satellite',
    label: 'Satellite',
    attribution:
      'Source: Esri, Maxar, Earthstar Geographics · Labels © Stadia Maps © Stamen Design ' +
      OSM_ATTRIBUTION,
    available: () => true,
    style: () => ({
      version: 8,
      sources: {
        'esri-imagery': {
          type: 'raster',
          tiles: [
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          ],
          tileSize: 256,
          maxzoom: 19,
          attribution: 'Source: Esri, Maxar, Earthstar Geographics',
        },
        // Stamen Toner Labels via Stadia Maps — transparent label-only raster
        // layered on top of Esri imagery so cities, roads and admin names are
        // legible. Stadia serves these without an API key from referrer-locked
        // origins; production uses Vercel's host, dev uses localhost.
        'stadia-labels': {
          type: 'raster',
          tiles: [
            'https://tiles.stadiamaps.com/tiles/stamen_toner_labels/{z}/{x}/{y}.png',
          ],
          tileSize: 256,
          maxzoom: 18,
          attribution: '© Stadia Maps © Stamen Design ' + OSM_ATTRIBUTION,
        },
      },
      layers: [
        {
          id: 'esri-imagery-layer',
          type: 'raster',
          source: 'esri-imagery',
        },
        {
          id: 'stadia-labels-layer',
          type: 'raster',
          source: 'stadia-labels',
          paint: { 'raster-opacity': 0.9 },
        },
      ],
    }),
  },
  terrain: {
    id: 'terrain',
    label: 'Terrain',
    attribution: '© OpenTopoMap (CC-BY-SA) · ' + OSM_ATTRIBUTION,
    available: () => true,
    style: () => ({
      version: 8,
      sources: {
        opentopomap: {
          type: 'raster',
          tiles: [
            'https://a.tile.opentopomap.org/{z}/{x}/{y}.png',
            'https://b.tile.opentopomap.org/{z}/{x}/{y}.png',
            'https://c.tile.opentopomap.org/{z}/{x}/{y}.png',
          ],
          tileSize: 256,
          minzoom: 0,
          maxzoom: 17,
          attribution: '© OpenTopoMap (CC-BY-SA)',
        },
      },
      layers: [
        {
          id: 'opentopomap-layer',
          type: 'raster',
          source: 'opentopomap',
        },
      ],
    }),
  },
  bhuvan: {
    id: 'bhuvan',
    label: 'Bhuvan',
    attribution: '© Bhuvan / NRSC / ISRO',
    available: () => true,
    // ISRO's public WMS, served as a raster source. `india3` is the public
    // basemap layer; if it ever stops serving, swap to `lulc50k_1112` (the
    // land-use/land-cover 1:50k mosaic) as a fallback. We hit the `vec2` host
    // since `vec1` returns 5xx for some BBOX requests in mid-2026.
    style: () => ({
      version: 8,
      sources: {
        bhuvan: {
          type: 'raster',
          tiles: [
            'https://bhuvan-vec2.nrsc.gov.in/bhuvan/wms?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=india3&STYLES=&FORMAT=image/png&TRANSPARENT=true&SRS=EPSG:3857&WIDTH=256&HEIGHT=256&BBOX={bbox-epsg-3857}',
          ],
          tileSize: 256,
          attribution: '© Bhuvan / NRSC / ISRO',
        },
      },
      layers: [
        {
          id: 'bhuvan-layer',
          type: 'raster',
          source: 'bhuvan',
        },
      ],
    }),
  },
};

export const basemapOrder: BasemapId[] = ['streets', 'satellite', 'terrain', 'bhuvan'];

export const defaultBasemap: BasemapId = 'streets';
