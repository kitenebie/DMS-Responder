import { getApp } from '@react-native-firebase/app';
import { getDatabase, ref, set } from '@react-native-firebase/database';
import { NativeModules } from 'react-native';

type LocationPayload = {
  location: {
    latitude: number;
    longitude: number;
    updatedAt: string;
  };
  updatedAt: string;
};

let hasLoggedRestFallback = false;
let hasLoggedPermissionBlocked = false;
let locationWriteBlocked = false;
let nativeRtdbWriteUnavailable = false;

const asResponderId = (userId: number): string | null => {
  if (!Number.isFinite(userId) || userId <= 0) {
    return null;
  }
  return String(userId);
};

const hasNativeSet = (database: ReturnType<typeof getDatabase>): boolean => {
  const nativeModule = (database as unknown as { native?: { set?: unknown } }).native;
  return typeof nativeModule?.set === 'function';
};

const hasNativeRtdbModules = (): boolean => {
  const modules = NativeModules as Record<string, { set?: unknown; on?: unknown } | undefined>;
  return (
    typeof modules.RNFBDatabaseReferenceModule?.set === 'function' &&
    typeof modules.RNFBDatabaseQueryModule?.on === 'function'
  );
};

const isPermissionDenied = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error);
  return /permission denied|401|403/i.test(message);
};

const isNativeRtdbUnavailable = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error);
  return /this\._database\.native\.(set|on)\s+is not a function/i.test(message);
};

const saveViaRest = async (
  databaseURL: string,
  responderId: string,
  payload: LocationPayload
): Promise<void> => {
  const baseUrl = databaseURL.replace(/\/+$/, '');
  const url = `${baseUrl}/responders/${encodeURIComponent(responderId)}.json`;
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `RTDB REST write failed (${response.status}) ${response.statusText}: ${errorBody.slice(0, 200)}`
    );
  }
};

/**
 * Saves or updates the responder's current location in Firebase Realtime Database.
 *
 * Uses the default RTDB instance from google-services.json (firebase_url).
 * Do not pass a custom URL to getDatabase().
 *
 * Data is written to: `responders/{userId}`
 */
export const saveResponderLocation = async (
  userId: number,
  latitude: number,
  longitude: number
): Promise<void> => {
  if (locationWriteBlocked) {
    return;
  }

  const responderId = asResponderId(userId);
  if (!responderId) {
    return;
  }
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return;
  }

  const updatedAt = new Date().toISOString();
  const payload: LocationPayload = {
    location: {
      latitude,
      longitude,
      updatedAt,
    },
    updatedAt,
  };

  try {
    const app = getApp();
    let didWriteWithNative = false;

    if (!nativeRtdbWriteUnavailable && hasNativeRtdbModules()) {
      const db = getDatabase(app);
      if (hasNativeSet(db)) {
        await set(ref(db, `responders/${responderId}`), payload);
        didWriteWithNative = true;
      }
    }

    if (!didWriteWithNative && !nativeRtdbWriteUnavailable) {
      nativeRtdbWriteUnavailable = true;
      if (!hasLoggedRestFallback) {
        hasLoggedRestFallback = true;
        console.warn(
          '[FirebaseLocation] RTDB native module is unavailable. Falling back to REST writes.'
        );
      }
    }

    if (!didWriteWithNative) {
      const databaseURL = app.options.databaseURL;
      if (!databaseURL) {
        throw new Error('Firebase app has no databaseURL configured for RTDB REST fallback.');
      }

      await saveViaRest(databaseURL, responderId, payload);
    }

    console.log(
      '[FirebaseLocation] Location saved: userId=' +
        responderId +
        ', lat=' +
        latitude +
        ', lng=' +
        longitude
    );
  } catch (error) {
    if (isPermissionDenied(error)) {
      locationWriteBlocked = true;
      if (!hasLoggedPermissionBlocked) {
        hasLoggedPermissionBlocked = true;
        console.warn(
          '[FirebaseLocation] RTDB write denied by rules (401/403). Pausing further RTDB writes until app restart.'
        );
      }
      return;
    } else if (isNativeRtdbUnavailable(error)) {
      nativeRtdbWriteUnavailable = true;
      if (!hasLoggedRestFallback) {
        hasLoggedRestFallback = true;
        console.warn(
          '[FirebaseLocation] RTDB native module is unavailable. Falling back to REST writes.'
        );
      }
      return;
    } else {
      console.warn(
        '[FirebaseLocation] Failed to update location in RTDB: userId=' +
          responderId +
          ', lat=' +
          latitude +
          ', lng=' +
          longitude,
        error
      );
    }
  }
};
