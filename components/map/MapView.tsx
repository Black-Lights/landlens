'use client';

import 'maplibre-gl/dist/maplibre-gl.css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Map, {
  AttributionControl,
  Layer,
  NavigationControl,
  ScaleControl,
  Source,
  type MapLayerMouseEvent,
  type MapRef,
} from 'react-map-gl/maplibre';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import { bbox } from '@turf/turf';

import { basemaps, defaultBasemap, type BasemapId } from '@/lib/map/basemaps';
import {
  DRILL_ZOOM,
  INDIA_CENTER,
  INDIA_DEFAULT_ZOOM,
  INDIA_MAX_BOUNDS,
  type DrillLevel,
} from '@/lib/map/constants';
import { BasemapSwitcher } from './BasemapSwitcher';
import { Breadcrumb, type DrillCrumb } from './Breadcrumb';
import { CoordReadout } from './CoordReadout';
import { NorthArrow } from './NorthArrow';
import { LocateMe } from './LocateMe';

const STATES_SOURCE_ID = 'india-states';
const STATES_FILL_LAYER = 'india-states-fill';
const STATES_LINE_LAYER = 'india-states-line';
const STATES_HOVER_LAYER = 'india-states-hover';
const GPS_SOURCE_ID = 'user-gps';
const GPS_ACCURACY_LAYER = 'user-gps-accuracy';
const GPS_DOT_LAYER = 'user-gps-dot';

type StateProps = { ST_NM?: string; NAME_1?: string };

function stateName(feat: Feature<Geometry, StateProps>): string {
  return feat.properties?.ST_NM ?? feat.properties?.NAME_1 ?? 'Unknown';
}

export function MapView() {
  const mapRef = useRef<MapRef | null>(null);
  const maptilerKey = process.env.NEXT_PUBLIC_MAPTILER_KEY;

  const initialBasemap: BasemapId = maptilerKey ? defaultBasemap : 'satellite';
  const [basemapId, setBasemapId] = useState<BasemapId>(initialBasemap);
  const [hoveredState, setHoveredState] = useState<string | null>(null);
  const [trail, setTrail] = useState<DrillCrumb[]>([{ level: 'india', label: 'India' }]);
  const [cursor, setCursor] = useState<{ lat: number | null; lng: number | null }>({
    lat: null,
    lng: null,
  });
  const [bearing, setBearing] = useState(0);
  const [gps, setGps] = useState<{ lng: number; lat: number; accuracy: number } | null>(null);

  const mapStyle = useMemo(
    () => basemaps[basemapId].style({ maptilerKey }),
    [basemapId, maptilerKey]
  );
  const attributionLine = basemaps[basemapId].attribution;

  const onMouseMove = useCallback((e: MapLayerMouseEvent) => {
    setCursor({ lat: e.lngLat.lat, lng: e.lngLat.lng });
    const feat = e.features?.[0] as Feature<Geometry, StateProps> | undefined;
    setHoveredState(feat ? stateName(feat) : null);
  }, []);

  const onMouseLeave = useCallback(() => {
    setHoveredState(null);
  }, []);

  const onClick = useCallback((e: MapLayerMouseEvent) => {
    const feat = e.features?.[0] as Feature<Geometry, StateProps> | undefined;
    if (!feat) return;
    const name = stateName(feat);
    const [minX, minY, maxX, maxY] = bbox(feat);
    mapRef.current?.fitBounds(
      [
        [minX, minY],
        [maxX, maxY],
      ],
      { padding: 60, duration: 900, maxZoom: DRILL_ZOOM.state + 0.5 }
    );
    setTrail([
      { level: 'india', label: 'India' },
      { level: 'state', label: name },
    ]);
  }, []);

  const onJump = useCallback((index: number) => {
    if (index === 0) {
      mapRef.current?.flyTo({
        center: INDIA_CENTER,
        zoom: INDIA_DEFAULT_ZOOM,
        bearing: 0,
        pitch: 0,
        duration: 900,
      });
      setTrail([{ level: 'india', label: 'India' }]);
    }
    // Deeper levels (district/tehsil/village) drill in Sprint 3 with parcel data.
  }, []);

  const onLocate = useCallback((lat: number, lng: number, accuracy: number) => {
    setGps({ lat, lng, accuracy });
    mapRef.current?.flyTo({ center: [lng, lat], zoom: 14, duration: 1000 });
  }, []);

  const onResetBearing = useCallback(() => {
    mapRef.current?.easeTo({ bearing: 0, pitch: 0, duration: 300 });
  }, []);

  // GeoJSON for user GPS — accuracy circle + dot.
  const gpsGeoJson = useMemo<FeatureCollection | null>(() => {
    if (!gps) return null;
    return {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [gps.lng, gps.lat] },
          properties: { accuracy: gps.accuracy },
        },
      ],
    };
  }, [gps]);

  // Pulsing animation for the GPS dot — drive a CSS animation on the layer paint
  // via state. MapLibre layer paint props don't animate via CSS, so we vary the
  // radius via React state on a ticker.
  const [pulse, setPulse] = useState(0);
  useEffect(() => {
    if (!gps) return;
    const id = setInterval(() => setPulse((p) => (p + 1) % 60), 50);
    return () => clearInterval(id);
  }, [gps]);
  const pulseRadius = 6 + Math.sin((pulse / 60) * Math.PI * 2) * 2;

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-slate-100">
      <Map
        ref={mapRef}
        initialViewState={{
          longitude: INDIA_CENTER[0],
          latitude: INDIA_CENTER[1],
          zoom: INDIA_DEFAULT_ZOOM,
        }}
        mapStyle={mapStyle as never}
        maxBounds={INDIA_MAX_BOUNDS}
        attributionControl={false}
        interactiveLayerIds={[STATES_FILL_LAYER]}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
        onClick={onClick}
        onMove={(e) => setBearing(e.viewState.bearing)}
        cursor={hoveredState ? 'pointer' : 'grab'}
        style={{ width: '100%', height: '100%' }}
      >
        <NavigationControl position="bottom-right" showCompass={false} />
        <ScaleControl position="bottom-left" maxWidth={120} unit="metric" />
        <AttributionControl
          position="bottom-right"
          compact
          customAttribution={attributionLine}
        />

        <Source
          id={STATES_SOURCE_ID}
          type="geojson"
          data="/data/boundaries/india-states.geojson"
          promoteId="ST_NM"
        >
          <Layer
            id={STATES_FILL_LAYER}
            type="fill"
            paint={{ 'fill-color': '#4F46E5', 'fill-opacity': 0 }}
          />
          <Layer
            id={STATES_LINE_LAYER}
            type="line"
            paint={{
              'line-color': '#1e293b',
              'line-width': 0.8,
              'line-opacity': 0.55,
            }}
          />
          {hoveredState && (
            <Layer
              id={STATES_HOVER_LAYER}
              type="fill"
              filter={['==', ['get', 'ST_NM'], hoveredState]}
              paint={{ 'fill-color': '#4F46E5', 'fill-opacity': 0.18 }}
            />
          )}
        </Source>

        {gpsGeoJson && (
          <Source id={GPS_SOURCE_ID} type="geojson" data={gpsGeoJson}>
            <Layer
              id={GPS_ACCURACY_LAYER}
              type="circle"
              paint={{
                'circle-radius': [
                  'interpolate',
                  ['exponential', 2],
                  ['zoom'],
                  0,
                  0,
                  20,
                  ['/', ['get', 'accuracy'], 0.5],
                ],
                'circle-color': '#3b82f6',
                'circle-opacity': 0.15,
                'circle-stroke-color': '#3b82f6',
                'circle-stroke-width': 1,
                'circle-stroke-opacity': 0.5,
              }}
            />
            <Layer
              id={GPS_DOT_LAYER}
              type="circle"
              paint={{
                'circle-radius': pulseRadius,
                'circle-color': '#2563eb',
                'circle-stroke-color': '#ffffff',
                'circle-stroke-width': 2,
              }}
            />
          </Source>
        )}
      </Map>

      <BasemapSwitcher value={basemapId} onChange={setBasemapId} maptilerKey={maptilerKey} />

      <Breadcrumb trail={trail} onJump={onJump} />

      <div className="pointer-events-none absolute right-3 top-16 z-20">
        <NorthArrow bearing={bearing} onReset={onResetBearing} />
      </div>

      <div className="pointer-events-none absolute bottom-3 left-1/2 z-20 -translate-x-1/2">
        <CoordReadout lat={cursor.lat} lng={cursor.lng} />
      </div>

      <div className="pointer-events-none absolute bottom-24 right-3 z-20 sm:bottom-16">
        <LocateMe onLocate={onLocate} />
      </div>
    </div>
  );
}
