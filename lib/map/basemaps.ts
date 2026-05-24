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
    attribution: 'Source: Esri, Maxar, Earthstar Geographics',
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
      },
      layers: [
        {
          id: 'esri-imagery-layer',
          type: 'raster',
          source: 'esri-imagery',
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
    style: () => ({
      version: 8,
      sources: {
        bhuvan: {
          type: 'raster',
          tiles: [
            'https://bhuvan-vec1.nrsc.gov.in/bhuvan/wms?service=WMS&request=GetMap&version=1.1.1&layers=india3&styles=&format=image/png&transparent=false&srs=EPSG:3857&width=256&height=256&bbox={bbox-epsg-3857}',
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
