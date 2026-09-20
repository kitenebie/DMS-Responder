const OPEN_FREE_MAP_TILEJSON_URL = 'https://tiles.openfreemap.org/planet';

// A local bootstrap template keeps MapLibre from waiting for a remote style or
// TileJSON document during setup. OpenFreeMap serves dated tile snapshots with
// long cache lifetimes; the app refreshes this template in the background.
const OPEN_FREE_MAP_BOOTSTRAP_TILE_TEMPLATE =
  'https://tiles.openfreemap.org/planet/20260830_080001_pt/{z}/{x}/{y}.pbf';

const MAP_LABEL = ['coalesce', ['get', 'name:latin'], ['get', 'name_en'], ['get', 'name']];

export const createOpenFreeMapLightStyle = (tileTemplate: string) => ({
  version: 8,
  glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
  sources: {
    openmaptiles: {
      type: 'vector',
      tiles: [tileTemplate],
      minzoom: 0,
      maxzoom: 14,
      attribution:
        '&copy; <a href="https://openfreemap.org">OpenFreeMap</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
    },
  },
  layers: [
    {
      id: 'light-background',
      type: 'background',
      paint: { 'background-color': '#f2f3f0' },
    },
    {
      id: 'light-park',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'park',
      paint: { 'fill-color': '#e2eadf' },
    },
    {
      id: 'light-landcover-wood',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'landcover',
      minzoom: 9,
      filter: ['==', ['get', 'class'], 'wood'],
      paint: {
        'fill-color': '#dce4dc',
        'fill-opacity': ['interpolate', ['linear'], ['zoom'], 9, 0.25, 12, 0.8],
      },
    },
    {
      id: 'light-water',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'water',
      filter: ['!=', ['get', 'brunnel'], 'tunnel'],
      paint: { 'fill-color': '#c2d8e8' },
    },
    {
      id: 'light-waterway',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'waterway',
      paint: { 'line-color': '#b4cfdf', 'line-width': 1 },
    },
    {
      id: 'light-buildings',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'building',
      minzoom: 12,
      paint: {
        'fill-color': '#e4e2dc',
        'fill-outline-color': '#d4d1ca',
      },
    },
    {
      id: 'light-road-path',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      minzoom: 13,
      filter: ['==', ['get', 'class'], 'path'],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': '#deddda',
        'line-width': ['interpolate', ['exponential', 1.2], ['zoom'], 13, 1, 20, 9],
      },
    },
    {
      id: 'light-road-minor',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      minzoom: 8,
      filter: ['match', ['get', 'class'], ['minor', 'service', 'track'], true, false],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': '#ffffff',
        'line-width': ['interpolate', ['exponential', 1.45], ['zoom'], 12, 1, 20, 18],
      },
    },
    {
      id: 'light-road-major-casing',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      minzoom: 6,
      filter: [
        'match',
        ['get', 'class'],
        ['primary', 'secondary', 'tertiary', 'trunk'],
        true,
        false,
      ],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': '#d1cfc9',
        'line-width': ['interpolate', ['exponential', 1.3], ['zoom'], 6, 1, 12, 4, 20, 24],
      },
    },
    {
      id: 'light-road-major',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      minzoom: 6,
      filter: [
        'match',
        ['get', 'class'],
        ['primary', 'secondary', 'tertiary', 'trunk'],
        true,
        false,
      ],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': '#ffffff',
        'line-width': ['interpolate', ['exponential', 1.3], ['zoom'], 6, 0.5, 12, 3, 20, 20],
      },
    },
    {
      id: 'light-motorway-casing',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      minzoom: 5,
      filter: ['==', ['get', 'class'], 'motorway'],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': '#d8b89a',
        'line-width': ['interpolate', ['exponential', 1.35], ['zoom'], 5, 1, 12, 5, 20, 30],
      },
    },
    {
      id: 'light-motorway',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      minzoom: 5,
      filter: ['==', ['get', 'class'], 'motorway'],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': '#f7dfc5',
        'line-width': ['interpolate', ['exponential', 1.35], ['zoom'], 5, 0.5, 12, 3.5, 20, 26],
      },
    },
    {
      id: 'light-boundaries',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'boundary',
      filter: ['!=', ['get', 'maritime'], 1],
      paint: {
        'line-color': '#a6a6a6',
        'line-dasharray': [2, 2],
        'line-opacity': 0.65,
        'line-width': ['interpolate', ['linear'], ['zoom'], 4, 0.5, 12, 1.5],
      },
    },
    {
      id: 'light-road-name-major',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'transportation_name',
      minzoom: 12,
      filter: [
        'match',
        ['get', 'class'],
        ['motorway', 'primary', 'secondary', 'tertiary', 'trunk'],
        true,
        false,
      ],
      layout: {
        'symbol-placement': 'line',
        'text-field': MAP_LABEL,
        'text-font': ['Noto Sans Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 12, 11, 17, 14],
      },
      paint: {
        'text-color': '#555555',
        'text-halo-color': '#ffffff',
        'text-halo-width': 1,
      },
    },
    {
      id: 'light-road-name-minor',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'transportation_name',
      minzoom: 15,
      filter: ['match', ['get', 'class'], ['minor', 'service', 'track'], true, false],
      layout: {
        'symbol-placement': 'line',
        'text-field': MAP_LABEL,
        'text-font': ['Noto Sans Regular'],
        'text-size': 12,
      },
      paint: {
        'text-color': '#696969',
        'text-halo-color': '#ffffff',
        'text-halo-width': 1,
      },
    },
    {
      id: 'light-place-city',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'place',
      minzoom: 4,
      filter: ['match', ['get', 'class'], ['city', 'town'], true, false],
      layout: {
        'text-field': MAP_LABEL,
        'text-font': ['Noto Sans Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 5, 11, 12, 16],
        'text-max-width': 8,
      },
      paint: {
        'text-color': '#282828',
        'text-halo-color': '#ffffff',
        'text-halo-width': 1,
      },
    },
    {
      id: 'light-place-local',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'place',
      minzoom: 9,
      filter: [
        'match',
        ['get', 'class'],
        ['village', 'suburb', 'neighbourhood', 'quarter'],
        true,
        false,
      ],
      layout: {
        'text-field': MAP_LABEL,
        'text-font': ['Noto Sans Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 9, 10, 15, 13],
        'text-max-width': 8,
      },
      paint: {
        'text-color': '#454545',
        'text-halo-color': '#ffffff',
        'text-halo-width': 1,
      },
    },
  ],
});

export const OPEN_FREE_MAP_LIGHT_STYLE = createOpenFreeMapLightStyle(
  OPEN_FREE_MAP_BOOTSTRAP_TILE_TEMPLATE
);

export const OPEN_STREET_MAP_FALLBACK_STYLE = {
  version: 8,
  sources: {
    'osm-fallback': {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      maxzoom: 16,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
    },
  },
  layers: [
    {
      id: 'osm-fallback-basemap',
      type: 'raster',
      source: 'osm-fallback',
      minzoom: 0,
    },
  ],
};

let latestStylePromise: Promise<object | null> | null = null;

const isUsableTileTemplate = (value: unknown): value is string =>
  typeof value === 'string' &&
  value.startsWith('https://tiles.openfreemap.org/') &&
  value.includes('{z}') &&
  value.includes('{x}') &&
  value.includes('{y}');

/**
 * Refresh the versioned tile path without putting MapLibre's style setup on the
 * network critical path. Failure is harmless because the bundled path remains
 * available and the MapScreen still has its raster fallback.
 */
export const loadLatestOpenFreeMapLightStyle = (): Promise<object | null> => {
  if (latestStylePromise) return latestStylePromise;

  latestStylePromise = (async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6_000);

    try {
      const response = await fetch(OPEN_FREE_MAP_TILEJSON_URL, {
        signal: controller.signal,
      });
      if (!response.ok) return null;

      const tileJson = (await response.json()) as { tiles?: unknown[] };
      const tileTemplate = tileJson.tiles?.find(isUsableTileTemplate);
      if (!tileTemplate || tileTemplate === OPEN_FREE_MAP_BOOTSTRAP_TILE_TEMPLATE) {
        return null;
      }

      return createOpenFreeMapLightStyle(tileTemplate);
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  })();

  return latestStylePromise;
};
