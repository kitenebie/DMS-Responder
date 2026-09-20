import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra as
  | { googleMapsApiKey?: unknown; googleMapId?: unknown; openRouteServiceApiKey?: unknown }
  | undefined;

// This key is intentionally injected from app.json for native Google Maps and
// the Directions REST endpoint. Restrict it to the Android package/SHA-1 and
// only the Maps SDK + Directions API in Google Cloud before production use.
export const GOOGLE_MAPS_API_KEY =
  typeof extra?.googleMapsApiKey === 'string' ? extra.googleMapsApiKey : '';

export const GOOGLE_MAP_ID = typeof extra?.googleMapId === 'string' ? extra.googleMapId : '';

export const OPEN_ROUTE_SERVICE_API_KEY =
  typeof extra?.openRouteServiceApiKey === 'string' ? extra.openRouteServiceApiKey : '';
