import type { Geometry } from 'geojson';

// Shape the export pipeline expects. Mirrors the /api/parcels/:id response.
export interface ParcelExport {
  id: string;
  khasra_no: string | null;
  area_sqm: number;
  area_acres: number;
  area_hectares: number;
  land_type: string | null;
  boundary_source: string;
  geometry: Geometry;
  village: { id: string; name: string } | null;
  district: { id: string; name: string; lgd_code: string | null } | null;
  state: { id: string; name: string } | null;
  owners: {
    id: string;
    owner_name: string;
    father_or_spouse: string | null;
    ownership_type: string | null;
    share_fraction: string | null;
    registration_date: string | null;
    transfer_date: string | null;
    is_current: boolean;
  }[];
}
