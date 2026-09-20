import { create } from 'zustand';
import { OPEN_ROUTE_SERVICE_API_KEY } from '../src/config/maps';

interface RouteGeometry {
  type: 'LineString';
  coordinates: [number, number][];
}

export interface RouteStep {
  location: [number, number];
  instruction?: string;
  modifier?: string;
  type?: string;
}

type RouteProvider = 'openrouteservice' | 'osrm';

interface RouteState {
  routeGeometry: RouteGeometry | null;
  routeSteps: RouteStep[];
  routeProvider: RouteProvider | null;
  routeProfile: 'driving' | 'foot';
  isRouteLoading: boolean;
  error: string | null;
  setRouteProfile: (profile: 'driving' | 'foot') => void;
  fetchRoute: (params: {
    userLat: number;
    userLng: number;
    destLat: number;
    destLng: number;
  }) => Promise<void>;
  clearRoute: () => void;
}

interface CachedRoute {
  geometry: RouteGeometry;
  steps: RouteStep[];
  provider: RouteProvider;
  expiresAt: number;
}

const ORS_DIRECTIONS_URL = 'https://api.heigit.org/openrouteservice/v2/directions';
const ROUTE_CACHE_TTL_MS = 5 * 60 * 1000;
const routeCache = new Map<string, CachedRoute>();
const inFlightRoutes = new Map<string, Promise<CachedRoute>>();

const routeKey = (params: {
  userLat: number;
  userLng: number;
  destLat: number;
  destLng: number;
  profile: 'driving' | 'foot';
}) =>
  [
    params.profile,
    params.userLat.toFixed(5),
    params.userLng.toFixed(5),
    params.destLat.toFixed(5),
    params.destLng.toFixed(5),
  ].join(':');

const isQuotaResponse = (response: Response, payload: unknown) => {
  if (response.status === 429) return true;
  if (typeof payload !== 'object' || payload === null) return false;
  const error = (payload as { error?: { code?: unknown; message?: unknown } }).error;
  const message = typeof error?.message === 'string' ? error.message : '';
  return /quota|rate limit|too many requests/i.test(message);
};

const toRouteStep = (step: any, routeCoordinates: [number, number][]): RouteStep | null => {
  const waypointIndex = step?.way_points?.[0];
  const coordinates =
    typeof waypointIndex === 'number' ? routeCoordinates[waypointIndex] : step?.location;
  if (!Array.isArray(coordinates) || coordinates.length < 2) return null;
  return {
    location: [Number(coordinates[0]), Number(coordinates[1])],
    instruction: step?.instruction ?? step?.name,
    modifier: step?.modifier,
    type: step?.type?.toString(),
  };
};

const decodePolyline = (encoded: unknown): [number, number][] => {
  if (typeof encoded !== 'string') return [];
  const points: [number, number][] = [];
  let index = 0;
  let latitude = 0;
  let longitude = 0;

  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let value: number;
    do {
      value = encoded.charCodeAt(index++) - 63;
      result |= (value & 0x1f) << shift;
      shift += 5;
    } while (value >= 0x20 && index < encoded.length);
    latitude += result & 1 ? ~(result >> 1) : result >> 1;

    result = 0;
    shift = 0;
    do {
      value = encoded.charCodeAt(index++) - 63;
      result |= (value & 0x1f) << shift;
      shift += 5;
    } while (value >= 0x20 && index < encoded.length);
    longitude += result & 1 ? ~(result >> 1) : result >> 1;
    points.push([longitude / 1e5, latitude / 1e5]);
  }

  return points;
};

const requestOsrmRoute = async (
  params: Parameters<RouteState['fetchRoute']>[0],
  profile: 'driving' | 'foot'
): Promise<CachedRoute> => {
  const osrmProfile = profile === 'foot' ? 'foot' : 'driving';
  const url = `https://router.project-osrm.org/route/v1/${osrmProfile}/${params.userLng},${params.userLat};${params.destLng},${params.destLat}?overview=full&geometries=geojson&steps=true`;
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`OSRM route request failed: ${response.status}`);

  const data = await response.json();
  const route = data?.routes?.[0];
  const coordinates = route?.geometry?.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2)
    throw new Error('OSRM returned an invalid route.');

  return {
    geometry: { type: 'LineString', coordinates },
    steps:
      route?.legs?.[0]?.steps?.map((step: any) => ({
        location: step.maneuver?.location,
        instruction: step.maneuver?.instruction,
        modifier: step.maneuver?.modifier,
        type: step.maneuver?.type,
      })) ?? [],
    provider: 'osrm',
    expiresAt: Date.now() + ROUTE_CACHE_TTL_MS,
  };
};

const requestOpenRouteService = async (
  params: Parameters<RouteState['fetchRoute']>[0],
  profile: 'driving' | 'foot'
): Promise<CachedRoute> => {
  if (!OPEN_ROUTE_SERVICE_API_KEY) throw new Error('OpenRouteService is not configured.');

  const orsProfile = profile === 'foot' ? 'foot-walking' : 'driving-car';
  // ORS returns GeoJSON from this endpoint when the response media type is requested.
  const url = `${ORS_DIRECTIONS_URL}/${orsProfile}?api_key=${encodeURIComponent(OPEN_ROUTE_SERVICE_API_KEY)}&start=${params.userLng},${params.userLat}&end=${params.destLng},${params.destLat}`;
  const response = await fetch(url, {
    headers: { Accept: 'application/geo+json' },
  });
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    if (isQuotaResponse(response, data)) {
      return requestOsrmRoute(params, profile);
    }
    throw new Error(`OpenRouteService request failed: ${response.status}`);
  }

  const feature = data?.features?.[0];
  const coordinates = feature?.geometry?.coordinates ?? decodePolyline(data?.routes?.[0]?.geometry);
  if (!Array.isArray(coordinates) || coordinates.length < 2) {
    throw new Error('OpenRouteService returned an invalid route.');
  }

  const rawSteps =
    feature?.properties?.segments?.flatMap((segment: any) => segment?.steps ?? []) ?? [];
  return {
    geometry: { type: 'LineString', coordinates },
    steps: rawSteps
      .map((step: any) => toRouteStep(step, coordinates))
      .filter(Boolean) as RouteStep[],
    provider: 'openrouteservice',
    expiresAt: Date.now() + ROUTE_CACHE_TTL_MS,
  };
};

export const useRouteStore = create<RouteState>((set, get) => ({
  routeGeometry: null,
  routeSteps: [],
  routeProvider: null,
  routeProfile: 'driving',
  isRouteLoading: false,
  error: null,
  setRouteProfile: (routeProfile) => set({ routeProfile }),
  fetchRoute: async (params) => {
    const profile = get().routeProfile;
    const key = routeKey({ ...params, profile });
    const cached = routeCache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      set({
        routeGeometry: cached.geometry,
        routeSteps: cached.steps,
        routeProvider: cached.provider,
        isRouteLoading: false,
        error: null,
      });
      return;
    }

    set({ isRouteLoading: true, error: null });
    const existingRequest = inFlightRoutes.get(key);
    const request =
      existingRequest ??
      requestOpenRouteService(params, profile).finally(() => {
        inFlightRoutes.delete(key);
      });
    if (!existingRequest) inFlightRoutes.set(key, request);

    try {
      const route = await request;
      routeCache.set(key, route);
      set({
        routeGeometry: route.geometry,
        routeSteps: route.steps,
        routeProvider: route.provider,
        isRouteLoading: false,
        error:
          route.provider === 'osrm' ? 'OpenRouteService limit reached. Using OSRM route.' : null,
      });
    } catch (error) {
      set({
        isRouteLoading: false,
        error: error instanceof Error ? error.message : 'Route request failed',
      });
    }
  },
  clearRoute: () => {
    set({
      routeGeometry: null,
      routeSteps: [],
      routeProvider: null,
      isRouteLoading: false,
      error: null,
    });
  },
}));
