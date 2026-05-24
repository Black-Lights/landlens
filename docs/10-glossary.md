# 10 — Glossary

Cadastral and geospatial terms used in LandLens, explained in plain English. Sorted alphabetically.

---

**AlphaEarth Foundations**
A geospatial AI model by Google DeepMind (released July 2025). It looks at every 10×10 meter patch on Earth and produces a 64-number "fingerprint" that captures what's there — crops, buildings, water, roads, soil type. We use these fingerprints to help our AI segment parcels.

**Bhu-Naksha**
Hindi for "land map." The official cadastral mapping system used by Indian state governments. Each state has its own portal (bhunaksha.up.gov.in, bhunaksha.ap.gov.in, etc.). The data is good but the UI is from 2008 and there's no unified search.

**Bhulekh**
Hindi for "land record." The text-based record showing who owns what, area, and history. State-specific portals like UP Bhulekh, MP Bhulekh, etc. Bhulekh = "the record"; Bhu-Naksha = "the map."

**Bigha**
A traditional Indian unit of land area. The catch: it means different things in different states. In UP it's about 0.25 acres. In Bengal it's 0.33 acres. We always convert to square meters for storage.

**Cadastre / Cadastral**
The official record of who owns what land, with maps showing boundaries. The Indian cadastre is a mix of digital (some states) and paper (many places).

**Centroid**
The geometric center of a polygon. Useful because clicking a centroid is faster than checking if a point is inside the polygon. We pre-compute and store centroids for every parcel.

**Confidence score**
For AI-detected parcels, a number from 0 to 1 saying how sure we are. 1.0 = official government data. 0.5 = AI guess that needs human verification. Shown in the UI as a small badge.

**DILRMP**
Digital India Land Records Modernization Programme. A central government scheme to digitize all land records nationwide. Progress varies wildly by state.

**EPSG codes**
A numbering system for coordinate systems.
- EPSG:4326 = WGS84 (latitude/longitude in degrees) — what GPS gives you
- EPSG:3857 = Web Mercator — what every web map displays in
- EPSG:32643 = UTM Zone 43N — accurate meters for most of India

We store in 4326, display in 3857, measure in UTM.

**Field Measurement Book (FMB)**
A surveyor's record containing exact plot corner coordinates, side lengths, and bearings. Where it exists, it gives us geometrically perfect polygons.

**Geocoding**
Converting an address ("Khadki village, Pune") into coordinates (lat/lng). Reverse geocoding is the opposite.

**Geometry / Geom**
In PostGIS, the column that holds shapes (points, lines, polygons). Stored efficiently as binary, queried with functions like `ST_Contains()`.

**GIST index**
A special database index for spatial data. Without it, finding "which parcel contains this point?" takes 30 seconds on a big database. With it, 5 milliseconds.

**GeoJSON**
A text format for sharing map data. Easy to read, but big. We use vector tiles instead for performance, and only return GeoJSON when users export.

**Guntha**
A traditional area unit in Maharashtra and Karnataka. 1 guntha = 101.17 square meters. 40 gunthas = 1 acre. Common in 7/12 extracts.

**Jamabandi**
A six-yearly land record document, especially in Punjab, Haryana, and J&K. Lists owners, area, crops grown, rents. Historical Jamabandis in Urdu script.

**Khasra number**
The plot number in an Indian village. Each piece of land has a Khasra number. Sometimes with sub-divisions like "123/4" or "123/A".

**Khatauni**
The "account book" of a landowner. Lists all the Khasras they own in a village.

**KML**
Keyhole Markup Language. The format Google Earth uses. We support KML export so users can open their parcel in Google Earth.

**LGD code**
Local Government Directory code. A unique number for every administrative unit in India — state, district, block, village. Used to join datasets across government departments.

**Mutation**
The process of updating land records when ownership changes. After a sale, gift, inheritance, or court decision, the record is "mutated." Mutation records show ownership history.

**MVT (Mapbox Vector Tiles)**
A compressed binary format for sending map data to browsers. Tens of times smaller than GeoJSON. We serve all parcels and boundaries as MVT.

**PostGIS**
The geospatial extension for PostgreSQL. Adds 1000+ functions for working with maps. Industry standard. Free and open-source.

**Polygon**
A closed shape with three or more corners. Land parcels are polygons. A polygon's boundary is its perimeter; its area is what's inside.

**RoR — Record of Rights**
The legal document showing who owns a piece of land and how much they own (in case of joint ownership). Different states call it different things: Khatauni in UP, 7/12 in Maharashtra, RTC in Karnataka.

**SAM2 — Segment Anything Model v2**
Meta's open-source AI model that can draw an outline around almost anything in an image. We use it to detect parcel boundaries from satellite imagery.

**Sentinel-2**
A satellite operated by the European Space Agency. Takes a free image of every spot on Earth every 5 days at 10-meter resolution. Our main satellite data source.

**Shapefile**
An old (1990s) file format for map data. Still widely used by surveyors. Multiple files (.shp, .dbf, .shx) packaged together.

**Survey number**
Similar to Khasra number but used in southern Indian states (Karnataka, Tamil Nadu, Andhra). Identifies a plot.

**ULPIN (Bhu-Aadhaar)**
Unique Land Parcel Identification Number. A 14-character ID being assigned to every parcel in India. Once nationwide, this will be the primary key for all land. Rollout in progress.

**UTM — Universal Transverse Mercator**
A way of projecting the round Earth onto flat maps using meters instead of degrees. India spans UTM zones 42N through 47N. Used when accurate distance/area measurement matters.

**Vector tile**
See MVT.

**Web Mercator**
The map projection used by Google Maps, OpenStreetMap, and basically every web map. EPSG:3857. Distorts size near the poles (Greenland looks huge) but works well for zoom-and-pan navigation.

**WGS84**
The coordinate system used by GPS. Latitude (north-south) and longitude (east-west) in degrees. EPSG:4326. The "true" position of any point on Earth.

**7/12 extract**
The land record document used in Maharashtra and a few other states. Named after forms 7 and 12 of village records. Shows ownership, cultivation, and area.
