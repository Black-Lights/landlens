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
  LAND_TYPE_COLORS,
  type DrillLevel,
} from '@/lib/map/constants';
import { BasemapSwitcher } from './BasemapSwitcher';
import { Breadcrumb, type DrillCrumb } from './Breadcrumb';
import { CoordReadout } from './CoordReadout';
import { NorthArrow } from './NorthArrow';
import { LocateMe } from './LocateMe';
import { ParcelSidebar } from './ParcelSidebar';
import { SearchPalette } from './SearchPalette';
import { Search } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { maptilerLanguage, type Locale } from '@/i18n/config';
import type { SearchResult } from '@/app/api/search/route';

// ── Layer / source ids ───────────────────────────────────────────────────────
const STATES_SRC = 'india-states';
const STATES_FILL = 'india-states-fill';
const STATES_LINE = 'india-states-line';
const STATES_HOVER = 'india-states-hover';

const DISTRICTS_SRC = 'india-districts';
const DISTRICTS_FILL = 'india-districts-fill';
const DISTRICTS_LINE = 'india-districts-line';
const DISTRICTS_HOVER = 'india-districts-hover';

const VILLAGES_SRC = 'india-villages';
const VILLAGES_FILL = 'india-villages-fill';
const VILLAGES_LINE = 'india-villages-line';
const VILLAGES_HOVER = 'india-villages-hover';

const PARCELS_SRC = 'india-parcels';
const PARCELS_FILL = 'india-parcels-fill';
const PARCELS_LINE = 'india-parcels-line';
const PARCELS_GLOW = 'india-parcels-glow';
const PARCELS_SELECTED = 'india-parcels-selected';

const GPS_SRC = 'user-gps';
const GPS_ACCURACY = 'user-gps-accuracy';
const GPS_DOT = 'user-gps-dot';

// ── Property typing ─────────────────────────────────────────────────────────
type StateProps = { ST_NM?: string; NAME_1?: string };
type DistrictProps = {
  district_name?: string;
  state_name?: string;
  district_lgd?: number;
  state_lgd?: number;
  dtcode11?: string;
};
type VillageProps = { id?: string; name?: string; admin_level?: number };
type ParcelProps = { id?: string; khasra_no?: string | null; land_type?: string | null };

const stateName = (f: Feature<Geometry, StateProps>) => f.properties?.ST_NM ?? f.properties?.NAME_1 ?? 'Unknown';
const districtName = (f: Feature<Geometry, DistrictProps>) => f.properties?.district_name ?? 'Unknown';
const villageName = (f: Feature<Geometry, VillageProps>) => f.properties?.name ?? 'Unnamed village';

interface DrillCtx {
  state?: { name: string };
  district?: { name: string; lgd?: number };
  village?: { id: string; name: string };
}

const FILL_OPACITY = {
  state: 0,
  district: 0,
  village: 0,
};

export function MapView() {
  const tBread = useTranslations('Breadcrumb');
  const tErrors = useTranslations('Errors');
  const tSearch = useTranslations('Search');
  const locale = useLocale() as Locale;
  const mapLang = maptilerLanguage(locale);
  const indiaLabel = tBread('india');

  const mapRef = useRef<MapRef | null>(null);
  const maptilerKey = process.env.NEXT_PUBLIC_MAPTILER_KEY;
  const initialBasemap: BasemapId = maptilerKey ? defaultBasemap : 'satellite';

  const [basemapId, setBasemapId] = useState<BasemapId>(initialBasemap);
  const [hovered, setHovered] = useState<{ level: DrillLevel; key: string } | null>(null);
  const [drill, setDrill] = useState<DrillCtx>({});
  const [trail, setTrail] = useState<DrillCrumb[]>([{ level: 'india', label: indiaLabel }]);
  const [cursor, setCursor] = useState<{ lat: number | null; lng: number | null }>({ lat: null, lng: null });
  const [bearing, setBearing] = useState(0);
  const [gps, setGps] = useState<{ lng: number; lat: number; accuracy: number } | null>(null);
  const [nearbyIds, setNearbyIds] = useState<string[]>([]);

  // Data layer URLs — populated when the user drills in. `null` keeps the
  // layer absent (react-map-gl Source unmounts).
  const [districtsUrl, setDistrictsUrl] = useState<string | null>(null);
  const [villagesUrl, setVillagesUrl] = useState<string | null>(null);
  const [parcelsUrl, setParcelsUrl] = useState<string | null>(null);
  const [districtsError, setDistrictsError] = useState<string | null>(null);
  const [selectedParcel, setSelectedParcel] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);

  const mapStyle = useMemo(
    () => basemaps[basemapId].style({ maptilerKey, language: mapLang }),
    [basemapId, maptilerKey, mapLang],
  );

  // The list of fill layer ids that should respond to clicks at the current
  // drill depth. Parcels are always interactive once shown.
  const interactiveLayerIds = useMemo<string[]>(() => {
    const ids = [STATES_FILL];
    if (districtsUrl) ids.push(DISTRICTS_FILL);
    if (villagesUrl) ids.push(VILLAGES_FILL);
    if (parcelsUrl) ids.push(PARCELS_FILL);
    return ids;
  }, [districtsUrl, villagesUrl, parcelsUrl]);

  // ── Mouse handlers ───────────────────────────────────────────────────────
  const onMouseMove = useCallback((e: MapLayerMouseEvent) => {
    setCursor({ lat: e.lngLat.lat, lng: e.lngLat.lng });
    const feat = e.features?.[0];
    if (!feat) {
      setHovered(null);
      return;
    }
    // The deepest layer wins (parcels > village > district > state).
    if (feat.layer.id === PARCELS_FILL) {
      const p = feat.properties as ParcelProps;
      setHovered({ level: 'village', key: p.id ?? '' });
    } else if (feat.layer.id === VILLAGES_FILL) {
      setHovered({ level: 'village', key: villageName(feat as Feature<Geometry, VillageProps>) });
    } else if (feat.layer.id === DISTRICTS_FILL) {
      setHovered({ level: 'district', key: districtName(feat as Feature<Geometry, DistrictProps>) });
    } else if (feat.layer.id === STATES_FILL) {
      setHovered({ level: 'state', key: stateName(feat as Feature<Geometry, StateProps>) });
    } else {
      setHovered(null);
    }
  }, []);

  const onMouseLeave = useCallback(() => setHovered(null), []);

  // ── Click drill-down ─────────────────────────────────────────────────────
  const drillIntoState = useCallback(async (feat: Feature<Geometry, StateProps>) => {
    const name = stateName(feat);
    const [w, s, e, n] = bbox(feat);
    mapRef.current?.fitBounds([[w, s], [e, n]], { padding: 60, duration: 900, maxZoom: DRILL_ZOOM.state + 0.5 });
    setDrill({ state: { name } });
    setTrail([{ level: 'india', label: indiaLabel }, { level: 'state', label: name }]);
    setVillagesUrl(null);
    setParcelsUrl(null);
    setDistrictsError(null);

    // Probe the bundled districts file via the API.
    try {
      const res = await fetch(`/api/districts?state=${encodeURIComponent(name)}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setDistrictsError(body?.error?.message ?? tErrors('districtsUnavailable', { state: name }));
        setDistrictsUrl(null);
        return;
      }
      // Use the URL directly so MapLibre fetches it (browser cache benefits).
      setDistrictsUrl(`/api/districts?state=${encodeURIComponent(name)}`);
    } catch {
      setDistrictsError(tErrors('districtsFailed', { state: name }));
      setDistrictsUrl(null);
    }
  }, [indiaLabel, tErrors]);

  const drillIntoDistrict = useCallback(async (feat: Feature<Geometry, DistrictProps>) => {
    const name = districtName(feat);
    const lgd = feat.properties?.district_lgd;
    const [w, s, e, n] = bbox(feat);
    mapRef.current?.fitBounds([[w, s], [e, n]], { padding: 60, duration: 900, maxZoom: DRILL_ZOOM.district + 0.5 });
    setDrill((prev) => ({ ...prev, district: { name, lgd } }));
    setTrail((prev) => {
      const next = prev.filter((c) => c.level === 'india' || c.level === 'state');
      // Ensure the India crumb is the translated label.
      if (next[0]?.level === 'india') next[0] = { level: 'india', label: indiaLabel };
      return [...next, { level: 'district', label: name }];
    });
    setParcelsUrl(null);

    // Ask the API for villages in this district's bbox. If the DB has cached
    // them (seeded), they come back instantly with stable UUIDs we can drill
    // into. Otherwise Overpass fetches live and the result has osm_id only.
    const bboxStr = `${w},${s},${e},${n}`;
    setVillagesUrl(`/api/villages?bbox=${encodeURIComponent(bboxStr)}`);
  }, [indiaLabel]);

  const drillIntoVillage = useCallback(async (feat: Feature<Geometry, VillageProps>) => {
    const id = feat.properties?.id;
    const name = villageName(feat as Feature<Geometry, VillageProps>);
    const [w, s, e, n] = bbox(feat);
    mapRef.current?.fitBounds([[w, s], [e, n]], { padding: 60, duration: 900, maxZoom: DRILL_ZOOM.village + 0.8 });
    setTrail((prev) => [...prev.filter((c) => c.level !== 'village'), { level: 'village', label: name }]);
    if (!id) {
      // OSM-only result, no UUID — no parcels to load.
      setParcelsUrl(null);
      setDrill((prev) => ({ ...prev, village: undefined }));
      return;
    }
    setDrill((prev) => ({ ...prev, village: { id, name } }));
    setParcelsUrl(`/api/parcels/by-village?village_id=${id}`);
  }, []);

  const onClick = useCallback(
    (e: MapLayerMouseEvent) => {
      const feat = e.features?.[0];
      if (!feat) return;
      if (feat.layer.id === PARCELS_FILL) {
        const p = feat.properties as ParcelProps;
        if (p.id) setSelectedParcel(p.id);
        return;
      }
      if (feat.layer.id === VILLAGES_FILL) {
        void drillIntoVillage(feat as Feature<Geometry, VillageProps>);
        return;
      }
      if (feat.layer.id === DISTRICTS_FILL) {
        void drillIntoDistrict(feat as Feature<Geometry, DistrictProps>);
        return;
      }
      if (feat.layer.id === STATES_FILL) {
        void drillIntoState(feat as Feature<Geometry, StateProps>);
        return;
      }
    },
    [drillIntoState, drillIntoDistrict, drillIntoVillage],
  );

  // ── Breadcrumb jump ─────────────────────────────────────────────────────
  const onJump = useCallback((index: number) => {
    setSelectedParcel(null);
    const target = trail[index];
    if (!target) return;
    if (target.level === 'india') {
      mapRef.current?.flyTo({ center: INDIA_CENTER, zoom: INDIA_DEFAULT_ZOOM, bearing: 0, pitch: 0, duration: 900 });
      setTrail([{ level: 'india', label: indiaLabel }]);
      setDrill({});
      setDistrictsUrl(null);
      setVillagesUrl(null);
      setParcelsUrl(null);
      setDistrictsError(null);
      return;
    }
    if (target.level === 'state') {
      setTrail((t) => t.slice(0, index + 1));
      setVillagesUrl(null);
      setParcelsUrl(null);
      setDrill((d) => ({ state: d.state }));
      return;
    }
    if (target.level === 'district') {
      setTrail((t) => t.slice(0, index + 1));
      setParcelsUrl(null);
      setDrill((d) => ({ state: d.state, district: d.district }));
      return;
    }
  }, [trail, indiaLabel]);

  // ── Locate me + nearby glow ─────────────────────────────────────────────
  const onLocate = useCallback((lat: number, lng: number, accuracy: number) => {
    setGps({ lat, lng, accuracy });
    mapRef.current?.flyTo({ center: [lng, lat], zoom: 14, duration: 1000 });
    void fetch(`/api/parcels/nearby?lat=${lat}&lng=${lng}&limit=5`)
      .then(async (r) => (r.ok ? r.json() : null))
      .then((j) => {
        const ids = j?.parcels?.map((p: { id: string }) => p.id) ?? [];
        setNearbyIds(ids);
      })
      .catch(() => setNearbyIds([]));
  }, []);

  const onResetBearing = useCallback(() => {
    mapRef.current?.easeTo({ bearing: 0, pitch: 0, duration: 300 });
  }, []);

  // ── Search → drill ──────────────────────────────────────────────────────
  // Translates a /api/search result into the drill state + layer fetches
  // needed to render it. Mirrors the click-handler drill logic so a search
  // pick lands the user in the same place a manual click would.
  const goToSearchResult = useCallback(async (r: SearchResult) => {
    setDistrictsError(null);
    setSelectedParcel(null);

    if (r.type === 'state') {
      const name = r.label;
      if (r.bbox) {
        mapRef.current?.fitBounds(
          [[r.bbox[0], r.bbox[1]], [r.bbox[2], r.bbox[3]]],
          { padding: 60, duration: 900, maxZoom: DRILL_ZOOM.state + 0.5 },
        );
      }
      setDrill({ state: { name } });
      setTrail([{ level: 'india', label: indiaLabel }, { level: 'state', label: name }]);
      setVillagesUrl(null);
      setParcelsUrl(null);
      try {
        const res = await fetch(`/api/districts?state=${encodeURIComponent(name)}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setDistrictsError(body?.error?.message ?? tErrors('districtsUnavailable', { state: name }));
          setDistrictsUrl(null);
        } else {
          setDistrictsUrl(`/api/districts?state=${encodeURIComponent(name)}`);
        }
      } catch {
        setDistrictsError(tErrors('districtsFailed', { state: name }));
        setDistrictsUrl(null);
      }
      return;
    }

    if (r.type === 'district') {
      const stateName = r.ancestors.state?.name;
      const districtName = r.label;
      if (r.bbox) {
        mapRef.current?.fitBounds(
          [[r.bbox[0], r.bbox[1]], [r.bbox[2], r.bbox[3]]],
          { padding: 60, duration: 900, maxZoom: DRILL_ZOOM.district + 0.5 },
        );
      }
      setDrill({ state: stateName ? { name: stateName } : undefined, district: { name: districtName } });
      const crumbs: DrillCrumb[] = [{ level: 'india', label: indiaLabel }];
      if (stateName) crumbs.push({ level: 'state', label: stateName });
      crumbs.push({ level: 'district', label: districtName });
      setTrail(crumbs);
      setParcelsUrl(null);
      // Districts file may not be bundled — best effort, mirrors state click.
      if (stateName) {
        try {
          const res = await fetch(`/api/districts?state=${encodeURIComponent(stateName)}`);
          setDistrictsUrl(res.ok ? `/api/districts?state=${encodeURIComponent(stateName)}` : null);
        } catch {
          setDistrictsUrl(null);
        }
      }
      // Load villages within the district bbox so subsequent clicks work.
      if (r.bbox) {
        const [w, s, e, n] = r.bbox;
        setVillagesUrl(`/api/villages?bbox=${encodeURIComponent(`${w},${s},${e},${n}`)}`);
      }
      return;
    }

    if (r.type === 'village') {
      const stateName = r.ancestors.state?.name;
      const districtName = r.ancestors.district?.name;
      const villageName = r.label;
      if (r.bbox) {
        mapRef.current?.fitBounds(
          [[r.bbox[0], r.bbox[1]], [r.bbox[2], r.bbox[3]]],
          { padding: 60, duration: 900, maxZoom: DRILL_ZOOM.village + 0.8 },
        );
      }
      setDrill({
        state: stateName ? { name: stateName } : undefined,
        district: districtName ? { name: districtName } : undefined,
        village: { id: r.id, name: villageName },
      });
      const crumbs: DrillCrumb[] = [{ level: 'india', label: indiaLabel }];
      if (stateName) crumbs.push({ level: 'state', label: stateName });
      if (districtName) crumbs.push({ level: 'district', label: districtName });
      crumbs.push({ level: 'village', label: villageName });
      setTrail(crumbs);
      if (stateName) {
        try {
          const res = await fetch(`/api/districts?state=${encodeURIComponent(stateName)}`);
          setDistrictsUrl(res.ok ? `/api/districts?state=${encodeURIComponent(stateName)}` : null);
        } catch {
          setDistrictsUrl(null);
        }
      }
      if (r.bbox) {
        // Use a slightly expanded bbox so villages around the picked one also
        // paint (handy for visual context).
        const [w, s, e, n] = r.bbox;
        const dx = (e - w) * 0.5;
        const dy = (n - s) * 0.5;
        setVillagesUrl(
          `/api/villages?bbox=${encodeURIComponent(`${w - dx},${s - dy},${e + dx},${n + dy}`)}`,
        );
      }
      setParcelsUrl(`/api/parcels/by-village?village_id=${r.id}`);
      return;
    }

    // khasra / owner → zoom to centroid + load parcels + open sidebar.
    if (r.type === 'khasra' || r.type === 'owner') {
      const target = r.centroid;
      const villageId = r.ancestors.village?.id;
      const villageName = r.ancestors.village?.name;
      const districtName = r.ancestors.district?.name;
      const stateName = r.ancestors.state?.name;
      if (target) {
        mapRef.current?.flyTo({ center: target, zoom: 17, duration: 1000 });
      }
      setDrill({
        state: stateName ? { name: stateName } : undefined,
        district: districtName ? { name: districtName } : undefined,
        village: villageId && villageName ? { id: villageId, name: villageName } : undefined,
      });
      const crumbs: DrillCrumb[] = [{ level: 'india', label: indiaLabel }];
      if (stateName) crumbs.push({ level: 'state', label: stateName });
      if (districtName) crumbs.push({ level: 'district', label: districtName });
      if (villageName) crumbs.push({ level: 'village', label: villageName });
      setTrail(crumbs);
      if (stateName) {
        try {
          const res = await fetch(`/api/districts?state=${encodeURIComponent(stateName)}`);
          setDistrictsUrl(res.ok ? `/api/districts?state=${encodeURIComponent(stateName)}` : null);
        } catch {
          setDistrictsUrl(null);
        }
      }
      if (villageId) {
        setParcelsUrl(`/api/parcels/by-village?village_id=${villageId}`);
      }
      if (r.parcel_id) setSelectedParcel(r.parcel_id);
    }
  }, [indiaLabel, tErrors]);

  // On first mount, honour ?parcel=<uuid> (deep link from /saved or a share
  // link) and ?signin=1 (set by middleware-redirected pages that need auth).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const parcel = params.get('parcel');
    if (parcel && /^[0-9a-f-]{36}$/i.test(parcel)) {
      setSelectedParcel(parcel);
    }
    if (params.get('signin') === '1') {
      // Fire after the AuthButton has mounted its event listener.
      setTimeout(() => window.dispatchEvent(new CustomEvent('landlens:signin')), 50);
    }
  }, []);

  // Cmd/Ctrl+K opens search. Ignore when the user is typing in another input.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isShortcut = (e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey);
      if (!isShortcut) return;
      const target = e.target as HTMLElement | null;
      // Don't steal focus from active text inputs — but our own palette input
      // has its own Esc handling and will already be open.
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        if (!searchOpen) {
          // Only suppress when the user is mid-typing elsewhere AND palette
          // isn't already open. The palette itself can re-trigger fine.
          return;
        }
      }
      e.preventDefault();
      setSearchOpen((v) => !v);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [searchOpen]);

  // ── GPS source / pulse ──────────────────────────────────────────────────
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

  const [pulse, setPulse] = useState(0);
  useEffect(() => {
    if (!gps) return;
    const id = setInterval(() => setPulse((p) => (p + 1) % 60), 50);
    return () => clearInterval(id);
  }, [gps]);
  const pulseRadius = 6 + Math.sin((pulse / 60) * Math.PI * 2) * 2;

  // Land-type expression for parcel fill colour
  const parcelFillExpression = useMemo(() => {
    const expr: (string | string[])[] = ['match', ['get', 'land_type']];
    for (const [k, v] of Object.entries(LAND_TYPE_COLORS)) {
      expr.push(k, v);
    }
    expr.push('#64748b'); // fallback grey
    return expr;
  }, []);

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
        interactiveLayerIds={interactiveLayerIds}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
        onClick={onClick}
        onMove={(e) => setBearing(e.viewState.bearing)}
        cursor={hovered ? 'pointer' : 'grab'}
        style={{ width: '100%', height: '100%' }}
      >
        <NavigationControl position="bottom-right" showCompass={false} />
        <ScaleControl position="bottom-left" maxWidth={120} unit="metric" />
        <AttributionControl position="bottom-left" compact />

        {/* ── States ─────────────────────────────────────────────────── */}
        <Source id={STATES_SRC} type="geojson" data="/data/boundaries/india-states.geojson" promoteId="ST_NM">
          <Layer id={STATES_FILL} type="fill" paint={{ 'fill-color': '#4F46E5', 'fill-opacity': FILL_OPACITY.state }} />
          <Layer id={STATES_LINE} type="line" paint={{ 'line-color': '#1e293b', 'line-width': 0.8, 'line-opacity': 0.55 }} />
          {hovered?.level === 'state' && (
            <Layer
              id={STATES_HOVER}
              type="fill"
              filter={['==', ['get', 'ST_NM'], hovered.key]}
              paint={{ 'fill-color': '#4F46E5', 'fill-opacity': 0.18 }}
            />
          )}
        </Source>

        {/* ── Districts ─────────────────────────────────────────────── */}
        {districtsUrl && (
          <Source id={DISTRICTS_SRC} type="geojson" data={districtsUrl} promoteId="district_name">
            <Layer
              id={DISTRICTS_FILL}
              type="fill"
              paint={{ 'fill-color': '#0ea5e9', 'fill-opacity': FILL_OPACITY.district }}
            />
            <Layer
              id={DISTRICTS_LINE}
              type="line"
              paint={{ 'line-color': '#0c4a6e', 'line-width': 0.6, 'line-opacity': 0.7, 'line-dasharray': [3, 2] }}
            />
            {hovered?.level === 'district' && (
              <Layer
                id={DISTRICTS_HOVER}
                type="fill"
                filter={['==', ['get', 'district_name'], hovered.key]}
                paint={{ 'fill-color': '#0ea5e9', 'fill-opacity': 0.2 }}
              />
            )}
          </Source>
        )}

        {/* ── Villages ──────────────────────────────────────────────── */}
        {villagesUrl && (
          <Source id={VILLAGES_SRC} type="geojson" data={villagesUrl} promoteId="name">
            <Layer
              id={VILLAGES_FILL}
              type="fill"
              paint={{ 'fill-color': '#f59e0b', 'fill-opacity': FILL_OPACITY.village }}
            />
            <Layer
              id={VILLAGES_LINE}
              type="line"
              paint={{ 'line-color': '#92400e', 'line-width': 0.7, 'line-opacity': 0.7 }}
            />
            {hovered?.level === 'village' && (
              <Layer
                id={VILLAGES_HOVER}
                type="fill"
                filter={['==', ['get', 'name'], hovered.key]}
                paint={{ 'fill-color': '#f59e0b', 'fill-opacity': 0.22 }}
              />
            )}
          </Source>
        )}

        {/* ── Parcels ───────────────────────────────────────────────── */}
        {parcelsUrl && (
          <Source id={PARCELS_SRC} type="geojson" data={parcelsUrl} promoteId="id">
            <Layer
              id={PARCELS_GLOW}
              type="fill"
              filter={nearbyIds.length > 0
                ? ['in', ['get', 'id'], ['literal', nearbyIds]]
                : ['==', ['get', 'id'], '__none__']}
              paint={{ 'fill-color': '#fde047', 'fill-opacity': 0.55 }}
            />
            <Layer
              id={PARCELS_FILL}
              type="fill"
              paint={{
                'fill-color': parcelFillExpression as never,
                'fill-opacity': 0.55,
              }}
            />
            <Layer
              id={PARCELS_LINE}
              type="line"
              paint={{ 'line-color': '#0f172a', 'line-width': 0.4, 'line-opacity': 0.7 }}
            />
            {selectedParcel && (
              <Layer
                id={PARCELS_SELECTED}
                type="line"
                filter={['==', ['get', 'id'], selectedParcel]}
                paint={{ 'line-color': '#4F46E5', 'line-width': 2.5 }}
              />
            )}
          </Source>
        )}

        {gpsGeoJson && (
          <Source id={GPS_SRC} type="geojson" data={gpsGeoJson}>
            <Layer
              id={GPS_ACCURACY}
              type="circle"
              paint={{
                'circle-radius': [
                  'interpolate', ['exponential', 2], ['zoom'],
                  0, 0,
                  20, ['/', ['get', 'accuracy'], 0.5],
                ],
                'circle-color': '#3b82f6',
                'circle-opacity': 0.15,
                'circle-stroke-color': '#3b82f6',
                'circle-stroke-width': 1,
                'circle-stroke-opacity': 0.5,
              }}
            />
            <Layer
              id={GPS_DOT}
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

      <button
        type="button"
        onClick={() => setSearchOpen(true)}
        aria-label={tSearch('buttonAria')}
        title={tSearch('buttonTitle')}
        className="pointer-events-auto absolute left-3 top-14 z-20 flex h-10 items-center gap-2 rounded-full bg-white/95 ps-3 pe-3.5 text-sm text-slate-600 shadow-md ring-1 ring-black/10 hover:bg-white hover:text-slate-900 md:pe-4"
      >
        <Search className="h-4 w-4" aria-hidden />
        <span className="hidden sm:inline">{tSearch('buttonLabel')}</span>
        <kbd className="hidden rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-mono text-slate-500 md:inline-block">
          ⌘K
        </kbd>
      </button>

      {districtsError && (
        <div
          role="status"
          className="pointer-events-auto absolute left-1/2 top-14 z-20 -translate-x-1/2 rounded-md bg-amber-50 px-3 py-1.5 text-xs text-amber-800 shadow ring-1 ring-amber-200"
        >
          {districtsError}
        </div>
      )}

      <div className="pointer-events-none absolute right-3 top-16 z-20">
        <NorthArrow bearing={bearing} onReset={onResetBearing} />
      </div>

      <div className="pointer-events-none absolute bottom-3 left-1/2 z-20 -translate-x-1/2">
        <CoordReadout lat={cursor.lat} lng={cursor.lng} />
      </div>

      <div className="pointer-events-none absolute bottom-24 right-4 z-20">
        <LocateMe onLocate={onLocate} />
      </div>

      <ParcelSidebar parcelId={selectedParcel} onClose={() => setSelectedParcel(null)} />

      <SearchPalette
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onSelect={(r) => void goToSearchResult(r)}
      />
    </div>
  );
}
