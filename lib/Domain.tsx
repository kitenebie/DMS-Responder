import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra as
  | { onlineApiUrl?: string; offlineMeshApiUrl?: string }
  | undefined;

export const ONLINE_API_URL = (extra?.onlineApiUrl || 'https://earms.online').replace(/\/+$/, '');
export const OFFLINE_MESH_API_URL = (extra?.offlineMeshApiUrl || 'http://10.0.0.2').replace(/\/+$/, '');
export let ip = ONLINE_API_URL;

let lastCheck = 0;
let checkInProgress: Promise<string> | null = null;

const isReachable = async (baseUrl: string) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);

  try {
    return (await fetch(`${baseUrl}/api/validate/network`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })).ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
};

export const getApiBaseUrl = () => {
  if (checkInProgress) return checkInProgress;
  if (Date.now() - lastCheck < 5000) return Promise.resolve(ip);

  checkInProgress = (async () => {
    ip = await isReachable(ONLINE_API_URL)
      ? ONLINE_API_URL
      : await isReachable(OFFLINE_MESH_API_URL)
        ? OFFLINE_MESH_API_URL
        : ONLINE_API_URL;
    lastCheck = Date.now();
    return ip;
  })().finally(() => {
    checkInProgress = null;
  });

  return checkInProgress;
};
