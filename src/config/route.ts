import Constants from 'expo-constants';

export const OSRM_BASE_URL = `${(Constants.expoConfig?.extra?.routeOsrmUrl || 'https://router.project-osrm.org').replace(/\/+$/, '')}/route/v1`;
