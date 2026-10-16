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
      paint: { 'background-color': '#F8FAFC' },
    },
    {
      id: 'light-park',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'park',
      paint: { 'fill-color': '#E3F2E6' },
    },
    {
      id: 'light-landcover-wood',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'landcover',
      minzoom: 9,
      filter: ['==', ['get', 'class'], 'wood'],
      paint: {
        'fill-color': '#D6E9DC',
        'fill-opacity': ['interpolate', ['linear'], ['zoom'], 9, 0.25, 12, 0.8],
      },
    },
    {
      id: 'light-water',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'water',
      filter: ['!=', ['get', 'brunnel'], 'tunnel'],
      paint: { 'fill-color': '#D6EAF8' },
    },
    {
      id: 'light-waterway',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'waterway',
      paint: { 'line-color': '#B7D9F0', 'line-width': 1 },
    },
    {
      id: 'light-buildings',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'building',
      minzoom: 12,
      paint: {
        'fill-color': '#E8EEF5',
        'fill-outline-color': '#D4E0EC',
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
        'line-color': '#C5D4E3',
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
        'line-color': '#F8FAFC',
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
        'line-color': '#C5D4E3',
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
        'line-color': '#F8FAFC',
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
        'line-color': '#8DB5DB',
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
        'line-color': '#BDD9F1',
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
        'line-color': '#94A3B8',
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
        'text-color': '#30445C',
        'text-halo-color': '#F8FAFC',
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
        'text-color': '#41556D',
        'text-halo-color': '#F8FAFC',
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
        'text-color': '#0F243D',
        'text-halo-color': '#F8FAFC',
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
        'text-color': '#41556D',
        'text-halo-color': '#F8FAFC',
        'text-halo-width': 1,
      },
    },
  ],
});

export const OPEN_FREE_MAP_LIGHT_STYLE = createOpenFreeMapLightStyle(
  OPEN_FREE_MAP_BOOTSTRAP_TILE_TEMPLATE
);

const DARK_LAYER_PAINT: Record<string, Record<string, string | number>> = {
  'light-background': { 'background-color': '#061326' },
  'light-park': { 'fill-color': '#0E3440' },
  'light-landcover-wood': { 'fill-color': '#102F3A' },
  'light-water': { 'fill-color': '#07182B' },
  'light-waterway': { 'line-color': '#17496B' },
  'light-buildings': { 'fill-color': '#102338', 'fill-outline-color': '#1C3550' },
  'light-road-path': { 'line-color': '#29425C' },
  'light-road-minor': { 'line-color': '#223850' },
  'light-road-major-casing': { 'line-color': '#18314B' },
  'light-road-major': { 'line-color': '#334F6E' },
  'light-motorway-casing': { 'line-color': '#12253B' },
  'light-motorway': { 'line-color': '#3B6389' },
  'light-boundaries': { 'line-color': '#44607B', 'line-opacity': 0.7 },
  'light-road-name-major': { 'text-color': '#DDEBFA', 'text-halo-color': '#13273D' },
  'light-road-name-minor': { 'text-color': '#B5C9E0', 'text-halo-color': '#13273D' },
  'light-place-city': { 'text-color': '#F1F6FC', 'text-halo-color': '#0D2035' },
  'light-place-local': { 'text-color': '#C7D7E9', 'text-halo-color': '#0D2035' },
};

export const createOpenFreeMapDarkStyle = (style: object) => {
  const lightStyle = style as {
    layers: { id: string; paint?: Record<string, unknown>; [key: string]: unknown }[];
    [key: string]: unknown;
  };

  return {
    ...lightStyle,
    layers: lightStyle.layers.map((layer) => ({
      ...layer,
      id: layer.id.replace(/^light-/, 'dark-'),
      paint: { ...layer.paint, ...DARK_LAYER_PAINT[layer.id] },
    })),
  };
};

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

export const OPEN_STREET_MAP_DARK_FALLBACK_STYLE = {
  ...OPEN_STREET_MAP_FALLBACK_STYLE,
  layers: [
    {
      ...OPEN_STREET_MAP_FALLBACK_STYLE.layers[0],
      paint: {
        'raster-brightness-min': 0.04,
        'raster-brightness-max': 0.42,
        'raster-saturation': -0.6,
      },
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
