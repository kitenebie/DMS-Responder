import { create } from 'zustand';

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

interface RouteState {
  routeGeometry: RouteGeometry | null;
  routeSteps: RouteStep[];
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

export const useRouteStore = create<RouteState>((set, get) => ({
  routeGeometry: null,
  routeSteps: [],
  routeProfile: 'driving',
  isRouteLoading: false,
  error: null,
  setRouteProfile: (routeProfile) => set({ routeProfile }),
  fetchRoute: async ({ userLat, userLng, destLat, destLng }) => {
    set({ isRouteLoading: true, error: null });
    try {
      const profile = get().routeProfile;
      const url = `https://router.project-osrm.org/route/v1/${profile}/${userLng},${userLat};${destLng},${destLat}?overview=full&geometries=geojson&steps=true`;
      const response = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) {
        set({ isRouteLoading: false, error: `Route request failed: ${response.status}` });
        return;
      }

      const data = await response.json();
      const route = data?.routes?.[0];
      const coordinates = route?.geometry?.coordinates;

      if (!Array.isArray(coordinates)) {
        set({ routeGeometry: null, routeSteps: [], isRouteLoading: false });
        return;
      }

      const steps =
        route?.legs?.[0]?.steps?.map((step: any) => ({
          location: step.maneuver?.location,
          instruction: step.maneuver?.instruction,
          modifier: step.maneuver?.modifier,
          type: step.maneuver?.type,
        })) ?? [];

      set({
        routeGeometry: { type: 'LineString', coordinates },
        routeSteps: steps,
        isRouteLoading: false,
        error: null,
      });
    } catch (error) {
      set({
        isRouteLoading: false,
        error: error instanceof Error ? error.message : 'Route request failed',
      });
    }
  },
  clearRoute: () => {
    set({ routeGeometry: null, routeSteps: [], isRouteLoading: false, error: null });
  },
}));
