import React, { memo, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  Text,
  Image,
  Animated,
  ActivityIndicator,
  AppState,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Incident } from '../src/types';
import { getMarkerImage } from './MarkerSelectScreen';
import {
  MapView,
  UserLocation,
  Camera,
  MarkerView,
  ShapeSource,
  type ShapeSourceRef,
  LineLayer,
  UserTrackingMode,
  Images,
  SymbolLayer,
  Logger,
} from '@maplibre/maplibre-react-native';
import * as Location from 'expo-location';
import { locationService, type LocationCoords } from './services/locationService';
import { useRouteStore } from './routeStore';
import { Icon } from './Icon';
import {
  loadLatestOpenFreeMapLightStyle,
  OPEN_FREE_MAP_LIGHT_STYLE,
  OPEN_STREET_MAP_FALLBACK_STYLE,
} from './mapStyles';

let lastMapNetworkTimeoutLogMs = 0;

// OSM Nominatim API for reverse geocoding
const OSM_REVERSE_GEOCODE_URL = 'https://nominatim.openstreetmap.org/reverse';

interface MapScreenProps {
  onMapPress?: () => void;
  onMapRelease?: () => void;
  isDarkMode: boolean;
  incident?: Incident | null;
  onToggleFullscreen?: () => void;
  isFullscreen: boolean;
  isActive?: boolean;
  showFullscreenToggle?: boolean;
  isMovingBearingEnabled?: boolean;
  onMovingBearingChange?: (enabled: boolean) => void;
  isFollowingUser?: boolean;
  onFollowingUserChange?: (following: boolean) => void;
  markerKey?: string | null;
}

interface RouteGeometry {
  type: 'LineString';
  coordinates: [number, number][];
}

const isValidLatLng = (lat: number, lng: number) =>
  Number.isFinite(lat) &&
  Number.isFinite(lng) &&
  lat >= -90 &&
  lat <= 90 &&
  lng >= -180 &&
  lng <= 180;

const normalizeIncidentCoords = (coords?: { lat: number; lng: number } | null) => {
  if (!coords) return null;
  const { lat, lng } = coords;
  if (isValidLatLng(lat, lng)) {
    return { lat, lng };
  }
  // Attempt swap if values look reversed
  if (isValidLatLng(lng, lat)) {
    return { lat: lng, lng: lat };
  }
  return null;
};

const toRadians = (deg: number) => (deg * Math.PI) / 180;
const distanceMeters = (a: [number, number], b: [number, number]) => {
  const R = 6371e3;
  const [lng1, lat1] = a;
  const [lng2, lat2] = b;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const lat1Rad = toRadians(lat1);
  const lat2Rad = toRadians(lat2);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(lat1Rad) * Math.cos(lat2Rad) * sinLng * sinLng;
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

/**
 * Calculate the minimum perpendicular distance (in meters) from a point
 * to a polyline (array of [lng, lat] coordinates).
 * Used to detect if the responder has deviated from the route.
 */
const distanceToPolyline = (point: [number, number], polyline: [number, number][]): number => {
  if (polyline.length === 0) return Infinity;
  if (polyline.length === 1) return distanceMeters(point, polyline[0]);

  let minDist = Infinity;

  for (let i = 0; i < polyline.length - 1; i++) {
    const A = polyline[i];
    const B = polyline[i + 1];

    // Project point P onto segment AB, get closest point on segment
    const ax = A[0],
      ay = A[1];
    const bx = B[0],
      by = B[1];
    const px = point[0],
      py = point[1];

    const dx = bx - ax;
    const dy = by - ay;
    const lenSq = dx * dx + dy * dy;

    let t = 0;
    if (lenSq > 0) {
      t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
    }

    const closestX = ax + t * dx;
    const closestY = ay + t * dy;

    const d = distanceMeters(point, [closestX, closestY]);
    if (d < minDist) minDist = d;
  }

  return minDist;
};

/**
 * Keeps the visible portion of the route anchored to the responder's latest
 * position. The full OSRM route stays in the store for navigation/rerouting,
 * while the already-travelled part is removed from what we draw on the map.
 */
const trimRouteToCurrentLocation = (
  route: RouteGeometry,
  location: LocationCoords
): RouteGeometry => {
  const coordinates = route.coordinates;
  if (coordinates.length < 2) return route;

  const point: [number, number] = [location.longitude, location.latitude];
  let closestSegmentIndex = 0;
  let closestDistance = Infinity;

  for (let index = 0; index < coordinates.length - 1; index += 1) {
    const [ax, ay] = coordinates[index];
    const [bx, by] = coordinates[index + 1];
    const dx = bx - ax;
    const dy = by - ay;
    const lengthSquared = dx * dx + dy * dy;
    const progress =
      lengthSquared > 0
        ? Math.max(0, Math.min(1, ((point[0] - ax) * dx + (point[1] - ay) * dy) / lengthSquared))
        : 0;
    const closestPoint: [number, number] = [ax + progress * dx, ay + progress * dy];
    const distance = distanceMeters(point, closestPoint);

    if (distance < closestDistance) {
      closestDistance = distance;
      closestSegmentIndex = index;
    }
  }

  return {
    type: 'LineString',
    // Use the GPS point as the first vertex so the line stays visually joined
    // to the marker between route refreshes.
    coordinates: [point, ...coordinates.slice(closestSegmentIndex + 1)],
  };
};

// How far (meters) off-route before triggering a reroute
const OFF_ROUTE_THRESHOLD_M = 35;
// How many consecutive off-route checks before actually rerouting (avoids GPS jitter false positives)
const OFF_ROUTE_CONSECUTIVE_CHECKS = 3;
const LOCATION_STATE_UPDATE_INTERVAL_MS = 200;
const LOCATION_UPLOAD_INTERVAL_MS = 3_000;
const HEADING_UPDATE_INTERVAL_MS = 150;
const HEADING_IDLE_UPDATE_INTERVAL_MS = 1_000;

const headingDelta = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);

const MapScreen = memo(function MapScreen({
  onMapPress,
  onMapRelease,
  isDarkMode,
  incident,
  onToggleFullscreen,
  isFullscreen,
  isActive = true,
  showFullscreenToggle = true,
  isMovingBearingEnabled: isMovingBearingEnabledProp,
  onMovingBearingChange,
  isFollowingUser: isFollowingUserProp,
  onFollowingUserChange,
  markerKey,
}: MapScreenProps) {
  const insets = useSafeAreaInsets();
  const fullscreenBottomInset = isFullscreen ? Math.max(insets.bottom, 16) : 0;
  const selectedMarkerImage = getMarkerImage(markerKey);
  const responderMarkerImageName = `responder-marker-${markerKey ?? 'default'}`;
  // Keep this object stable while the marker's coordinates animate. Re-creating
  // it every frame makes MapLibre re-register the image and can leave the icon
  // on its empty loading placeholder.
  const responderMarkerImages = useMemo(
    () => ({ [responderMarkerImageName]: selectedMarkerImage }),
    [responderMarkerImageName, selectedMarkerImage]
  );
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Logger.setLogCallback((log) => {
      const isTransientMapNetworkTimeout =
        log.level === 'error' &&
        (/failed to load tile.*timeout/i.test(log.message) ||
          /\[Setup\]: loading style failed: timeout/i.test(log.message));
      if (!isTransientMapNetworkTimeout) return false;

      const now = Date.now();
      if (__DEV__ && now - lastMapNetworkTimeoutLogMs >= 30_000) {
        lastMapNetworkTimeoutLogMs = now;
        console.log('[Map] Map network timeout; continuing with the local style/fallback.');
      }
      return true;
    });
  }, []);

  // Keep the destination pulse on the native UI thread and clean it up when
  // switching between embedded/fullscreen maps.
  useEffect(() => {
    const firstPulse = Animated.loop(
      Animated.timing(pulseAnim, {
        toValue: 1,
        duration: 1800,
        useNativeDriver: true,
      })
    );
    const secondPulse = Animated.loop(
      Animated.timing(pulseAnim2, {
        toValue: 1,
        duration: 1800,
        useNativeDriver: true,
      })
    );

    firstPulse.start();
    const secondPulseTimer = setTimeout(() => {
      secondPulse.start();
    }, 900);

    return () => {
      clearTimeout(secondPulseTimer);
      firstPulse.stop();
      secondPulse.stop();
      pulseAnim.setValue(0);
      pulseAnim2.setValue(0);
    };
  }, [pulseAnim, pulseAnim2]);

  const pulseScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.5, 2.6],
  });
  const pulseOpacity = pulseAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.7, 0.4, 0],
  });

  const pulseScale2 = pulseAnim2.interpolate({
    inputRange: [0, 1],
    outputRange: [0.5, 2.6],
  });
  const pulseOpacity2 = pulseAnim2.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.7, 0.4, 0],
  });

  const [initialCenter, setInitialCenter] = useState<[number, number] | null>(null);
  const [userLocation, setUserLocation] = useState<LocationCoords | null>(null);
  const [, setUserAddress] = useState<string>('Getting location...');
  const [hasLocationPermission, setHasLocationPermission] = useState(false);
  const [permissionMessage, setPermissionMessage] = useState<string | null>(null);
  const [useFallbackMapStyle, setUseFallbackMapStyle] = useState(false);
  const [openFreeMapStyle, setOpenFreeMapStyle] = useState<object>(OPEN_FREE_MAP_LIGHT_STYLE);
  const routeGeometry = useRouteStore((state) => state.routeGeometry);
  const routeSteps = useRouteStore((state) => state.routeSteps);
  const isRouteLoading = useRouteStore((state) => state.isRouteLoading);
  const routeError = useRouteStore((state) => state.error);
  const routeProfile = useRouteStore((state) => state.routeProfile);
  const setRouteProfile = useRouteStore((state) => state.setRouteProfile);
  const fetchRoute = useRouteStore((state) => state.fetchRoute);
  const clearRoute = useRouteStore((state) => state.clearRoute);
  const [routeVersion, setRouteVersion] = useState<number>(0);
  const [isFollowingUserLocal, setIsFollowingUserLocal] = useState<boolean>(true);
  const [isMovingBearingEnabledLocal, setIsMovingBearingEnabledLocal] = useState<boolean>(false);
  const isMovingBearingEnabled = isMovingBearingEnabledProp ?? isMovingBearingEnabledLocal;
  const isFollowingUser = isFollowingUserProp ?? isFollowingUserLocal;
  const setIsFollowingUser = onFollowingUserChange ?? setIsFollowingUserLocal;
  const isMovingBearingActive = isMovingBearingEnabled && isFollowingUser && hasLocationPermission;
  const [arrivalAlertIncidentId, setArrivalAlertIncidentId] = useState<Incident['id'] | null>(null);
  const [nextStepIndex, setNextStepIndex] = useState<number>(0);
  const [isRerouting, setIsRerouting] = useState(false);
  const [deviceHeading, setDeviceHeading] = useState<number>(0);
  const responderMarkerSourceRef = useRef<ShapeSourceRef | null>(null);
  const isUserInteractingRef = useRef(false);
  // Tracks consecutive off-route GPS checks to avoid false positives from jitter
  const offRouteCountRef = useRef<number>(0);
  // Stores the destination coordinates for rerouting without incident dependency
  const destCoordsRef = useRef<{ lat: number; lng: number } | null>(null);
  // Prevents simultaneous reroute fetches
  const isReroutingRef = useRef(false);
  // Ensures initial route is fetched once per incident (after userLocation becomes available)
  const initialRouteFetchKeyRef = useRef<string | null>(null);
  const lastInitialRouteAttemptMsRef = useRef<number>(0);
  const lastMarkerKeyAppliedRef = useRef<string | null>(null);
  const latestLocationRef = useRef<LocationCoords | null>(null);
  const lastLocationStateUpdateMsRef = useRef(0);
  const locationStateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastLocationUploadMsRef = useRef(0);
  const locationUploadInFlightRef = useRef(false);
  const lastHeadingUpdateMsRef = useRef(0);
  const lastHeadingRef = useRef<number | null>(null);

  useEffect(() => {
    let isMounted = true;

    void loadLatestOpenFreeMapLightStyle().then((latestStyle) => {
      if (isMounted && latestStyle) {
        setOpenFreeMapStyle(latestStyle);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const isValidHeading = useCallback((value: unknown): value is number => {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0;
  }, []);

  const setMovingBearingEnabled = useCallback(
    (enabled: boolean) => {
      if (onMovingBearingChange) {
        onMovingBearingChange(enabled);
      } else {
        setIsMovingBearingEnabledLocal(enabled);
      }
    },
    [onMovingBearingChange]
  );

  const commitLocationState = useCallback((nextLocation: LocationCoords) => {
    latestLocationRef.current = nextLocation;
    const elapsed = Date.now() - lastLocationStateUpdateMsRef.current;

    const commitLatest = () => {
      const latest = latestLocationRef.current;
      if (latest) {
        lastLocationStateUpdateMsRef.current = Date.now();
        setUserLocation(latest);
      }
      locationStateTimerRef.current = null;
    };

    if (elapsed >= LOCATION_STATE_UPDATE_INTERVAL_MS) {
      if (locationStateTimerRef.current) {
        clearTimeout(locationStateTimerRef.current);
        locationStateTimerRef.current = null;
      }
      commitLatest();
      return;
    }

    if (!locationStateTimerRef.current) {
      locationStateTimerRef.current = setTimeout(
        commitLatest,
        LOCATION_STATE_UPDATE_INTERVAL_MS - elapsed
      );
    }
  }, []);

  useEffect(
    () => () => {
      if (locationStateTimerRef.current) {
        clearTimeout(locationStateTimerRef.current);
        locationStateTimerRef.current = null;
      }
    },
    []
  );

  // Watch hardware compass heading
  useEffect(() => {
    let headingSub: Location.LocationSubscription | null = null;
    let isSubscribed = true;

    if (hasLocationPermission && isActive) {
      Location.watchHeadingAsync((data) => {
        if (isSubscribed) {
          const heading = data.trueHeading >= 0 ? data.trueHeading : data.magHeading;
          if (heading < 0) return;

          const now = Date.now();
          const lastHeading = lastHeadingRef.current;
          const elapsed = now - lastHeadingUpdateMsRef.current;
          const barelyChanged = lastHeading !== null && headingDelta(heading, lastHeading) < 1;

          if (
            elapsed < HEADING_UPDATE_INTERVAL_MS ||
            (barelyChanged && elapsed < HEADING_IDLE_UPDATE_INTERVAL_MS)
          ) {
            return;
          }

          lastHeadingRef.current = heading;
          lastHeadingUpdateMsRef.current = now;
          setDeviceHeading(heading);
        }
      })
        .then((sub) => {
          if (isSubscribed) headingSub = sub;
          else sub.remove();
        })
        .catch(console.error);
    }

    return () => {
      isSubscribed = false;
      if (headingSub) {
        headingSub.remove();
      }
    };
  }, [hasLocationPermission, isActive]);

  // Fetch user's current address using OSM Nominatim
  const fetchUserAddress = useCallback(async (latitude: number, longitude: number) => {
    try {
      const response = await fetch(
        `${OSM_REVERSE_GEOCODE_URL}?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'EM-DispatchResponder/1.0',
          },
        }
      );
      const data = await response.json();

      if (data && data.display_name) {
        // Format the address nicely
        const address = data.address;
        const formatted = [
          address.road,
          address.neighbourhood,
          address.suburb,
          address.town || address.city || address.municipality,
          address.state,
          address.country,
        ]
          .filter(Boolean)
          .join(', ');
        setUserAddress(formatted || data.display_name);
      } else {
        setUserAddress(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
      }
    } catch (error) {
      console.log('Error fetching address:', error);
      setUserAddress(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
    }
  }, []);

  // Initialize location and address
  useEffect(() => {
    let isMounted = true;

    (async () => {
      const granted = await locationService.requestPermission();
      if (!isMounted) return;

      setHasLocationPermission(granted);
      setPermissionMessage(
        granted ? null : 'Location permission is required to show your position.'
      );

      // Always obtain a new GPS reading when the map is opened. The native
      // foreground service may have continued moving while the JS app was
      // closed, so the in-memory cache is not a reliable route origin here.
      const location = granted
        ? await locationService.getCurrentLocation(true)
        : locationService.getDefaultLocation();
      if (!isMounted) return;

      setUserLocation(location);
      fetchUserAddress(location.latitude, location.longitude);
      setInitialCenter([location.longitude, location.latitude]);
    })();

    return () => {
      isMounted = false;
    };
  }, [fetchUserAddress]);

  const incidentCoordinates = incident?.coordinates;

  const normalizedIncident = useMemo(
    () => normalizeIncidentCoords(incidentCoordinates),
    [incidentCoordinates]
  );
  const destLat = normalizedIncident?.lat;
  const destLng = normalizedIncident?.lng;
  const incidentDistanceMeters = useMemo(() => {
    if (!userLocation || !normalizedIncident) return null;

    return distanceMeters(
      [userLocation.longitude, userLocation.latitude],
      [normalizedIncident.lng, normalizedIncident.lat]
    );
  }, [normalizedIncident, userLocation]);

  const currentMapStyle = useMemo(
    () => (useFallbackMapStyle ? OPEN_STREET_MAP_FALLBACK_STYLE : openFreeMapStyle),
    [openFreeMapStyle, useFallbackMapStyle]
  );

  // Reset route state when destination changes (incident changes).
  useEffect(() => {
    if (!incident?.id || destLat == null || destLng == null) {
      destCoordsRef.current = null;
      offRouteCountRef.current = 0;
      initialRouteFetchKeyRef.current = null;
      clearRoute();
      setNextStepIndex(0);
      setRouteVersion((prev) => prev + 1);
      return;
    }

    destCoordsRef.current = { lat: destLat, lng: destLng };
    offRouteCountRef.current = 0;
    initialRouteFetchKeyRef.current = null;
    clearRoute();
    setNextStepIndex(0);
    setRouteVersion((prev) => prev + 1);
  }, [incident?.id, destLat, destLng, clearRoute]);

  // Fetch initial route ONCE per incident, after userLocation becomes available.
  // Re-routing on deviation is handled separately by the off-route detector below.
  useEffect(() => {
    const userLat = userLocation?.latitude;
    const userLng = userLocation?.longitude;
    if (!incident?.id || destLat == null || destLng == null || userLat == null || userLng == null)
      return;

    const key = `${incident.id}:${destLat},${destLng}:${routeProfile}`;
    const hasExistingRoute =
      Array.isArray(routeGeometry?.coordinates) && routeGeometry.coordinates.length > 0;

    if (initialRouteFetchKeyRef.current === key && hasExistingRoute) return;

    // Avoid spamming OSRM if something is failing (e.g. network) while location updates stream in
    const now = Date.now();
    if (
      initialRouteFetchKeyRef.current === key &&
      now - lastInitialRouteAttemptMsRef.current < 5000
    ) {
      return;
    }

    initialRouteFetchKeyRef.current = key;
    lastInitialRouteAttemptMsRef.current = now;

    fetchRoute({
      userLat,
      userLng,
      destLat,
      destLng,
    });
    setRouteVersion((prev) => prev + 1);
    setNextStepIndex(0);
  }, [
    incident?.id,
    destLat,
    destLng,
    userLocation?.latitude,
    userLocation?.longitude,
    routeProfile,
    routeGeometry,
    fetchRoute,
  ]);

  // When the app is opened again, its Android foreground service may have
  // collected several newer GPS points while this screen was suspended.
  // Rebuild the route from a forced fresh reading instead of retaining the
  // old route origin shown before the app was closed.
  useEffect(() => {
    let previousAppState = AppState.currentState;

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      const returnedToForeground = previousAppState !== 'active' && nextAppState === 'active';
      previousAppState = nextAppState;

      if (
        !returnedToForeground ||
        !isActive ||
        !incident?.id ||
        destLat == null ||
        destLng == null ||
        isReroutingRef.current
      ) {
        return;
      }

      void (async () => {
        try {
          const currentLocation = await locationService.getCurrentLocation(true);
          setUserLocation(currentLocation);
          void fetchUserAddress(currentLocation.latitude, currentLocation.longitude);

          isReroutingRef.current = true;
          setIsRerouting(true);
          await fetchRoute({
            userLat: currentLocation.latitude,
            userLng: currentLocation.longitude,
            destLat,
            destLng,
          });
          initialRouteFetchKeyRef.current = `${incident.id}:${destLat},${destLng}:${routeProfile}`;
          lastInitialRouteAttemptMsRef.current = Date.now();
          offRouteCountRef.current = 0;
          setNextStepIndex(0);
          setRouteVersion((prev) => prev + 1);
        } catch (error) {
          console.warn('[MapScreen] Unable to refresh route after app resume:', error);
        } finally {
          isReroutingRef.current = false;
          setIsRerouting(false);
        }
      })();
    });

    return () => subscription.remove();
  }, [destLat, destLng, fetchRoute, fetchUserAddress, incident?.id, isActive, routeProfile]);

  const handleSetRouteProfile = useCallback(
    (nextProfile: 'driving' | 'foot') => {
      if (routeProfile === nextProfile) return;
      setRouteProfile(nextProfile);
      initialRouteFetchKeyRef.current = null;
      clearRoute();
      setNextStepIndex(0);
      setRouteVersion((prev) => prev + 1);
    },
    [clearRoute, routeProfile, setRouteProfile]
  );

  // Default route profile based on selected marker.
  // If the saved marker is "man" (On Foot), default routing should be "foot".
  useEffect(() => {
    if (!markerKey) return;
    if (lastMarkerKeyAppliedRef.current === markerKey) return;
    lastMarkerKeyAppliedRef.current = markerKey;

    if (markerKey === 'man') {
      handleSetRouteProfile('foot');
    }
  }, [handleSetRouteProfile, markerKey]);

  // Handle user location updates
  const handleCameraUserLocationChange = useCallback(
    (location: any) => {
      if (location && location.coords) {
        const { latitude, longitude, heading } = location.coords;
        if (!isValidLatLng(latitude, longitude)) return;

        const normalizedHeading = isValidHeading(heading) ? heading : undefined;
        const nextLocation = { latitude, longitude, heading: normalizedHeading };

        // Update the map source immediately from the native GPS event. This
        // keeps the custom icon synchronized with MapLibre's native user puck.
        responderMarkerSourceRef.current?.setNativeProps({
          shape: {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'Point',
              coordinates: [longitude, latitude],
            },
          },
        });
        // Route/UI calculations do not need to run at raw emulator frequency.
        commitLocationState(nextLocation);

        // Rate-limit network work and never queue overlapping requests.
        const now = Date.now();
        if (
          typeof normalizedHeading === 'number' &&
          !locationUploadInFlightRef.current &&
          now - lastLocationUploadMsRef.current >= LOCATION_UPLOAD_INTERVAL_MS
        ) {
          lastLocationUploadMsRef.current = now;
          locationUploadInFlightRef.current = true;
          locationService
            .sendLocationWithHeading({ latitude, longitude }, normalizedHeading)
            .catch((error) => {
              console.log('[MapScreen] Failed to send location with heading:', error);
            })
            .finally(() => {
              locationUploadInFlightRef.current = false;
            });
        }
      }
    },
    [commitLocationState, isValidHeading]
  );

  // Off-route detection: checks every time userLocation updates.
  // If the responder is more than OFF_ROUTE_THRESHOLD_M meters away from
  // the current route polyline for OFF_ROUTE_CONSECUTIVE_CHECKS checks in a row,
  // we trigger a reroute from their current position.
  useEffect(() => {
    if (!userLocation || !routeGeometry || isReroutingRef.current) return;
    if (!destCoordsRef.current) return;
    // Don't reroute if already arrived
    if (incidentDistanceMeters !== null && incidentDistanceMeters <= 30) return;

    const userPoint: [number, number] = [userLocation.longitude, userLocation.latitude];
    const polyline = routeGeometry.coordinates as [number, number][];
    const deviation = distanceToPolyline(userPoint, polyline);

    if (deviation > OFF_ROUTE_THRESHOLD_M) {
      offRouteCountRef.current += 1;
      console.log(
        `[Reroute] Off-route: ${deviation.toFixed(0)}m (check ${offRouteCountRef.current}/${OFF_ROUTE_CONSECUTIVE_CHECKS})`
      );

      if (offRouteCountRef.current >= OFF_ROUTE_CONSECUTIVE_CHECKS) {
        offRouteCountRef.current = 0;
        isReroutingRef.current = true;
        setIsRerouting(true);

        const dest = destCoordsRef.current;
        console.log('[Reroute] Recalculating route from current position...');

        fetchRoute({
          userLat: userLocation.latitude,
          userLng: userLocation.longitude,
          destLat: dest.lat,
          destLng: dest.lng,
        })
          .then(() => {
            isReroutingRef.current = false;
            setIsRerouting(false);
            setRouteVersion((prev) => prev + 1);
            setNextStepIndex(0);
            console.log('[Reroute] New route calculated successfully.');
          })
          .catch(() => {
            isReroutingRef.current = false;
            setIsRerouting(false);
            console.log('[Reroute] Reroute failed.');
          });
      }
    } else {
      // Back on route — reset counter
      if (offRouteCountRef.current > 0) {
        console.log('[Reroute] Back on route, resetting counter.');
      }
      offRouteCountRef.current = 0;
    }
  }, [userLocation, routeGeometry, incidentDistanceMeters, fetchRoute]);

  // Advance to next step when close to current step waypoint
  useEffect(() => {
    if (incidentDistanceMeters !== null && incidentDistanceMeters <= 30) {
      return;
    }

    if (!userLocation || routeSteps.length === 0) return;
    if (nextStepIndex >= routeSteps.length) return;

    const step = routeSteps[nextStepIndex];
    if (!step?.location) return;

    const distance = distanceMeters([userLocation.longitude, userLocation.latitude], step.location);

    if (distance <= 30) {
      setNextStepIndex((prev) => prev + 1);
    }
  }, [incidentDistanceMeters, userLocation, routeSteps, nextStepIndex]);

  useEffect(() => {
    if (!incident?.id || incidentDistanceMeters === null || incidentDistanceMeters > 30) {
      return;
    }

    if (arrivalAlertIncidentId === incident.id) {
      return;
    }
    setArrivalAlertIncidentId(incident.id);
  }, [arrivalAlertIncidentId, incident?.id, incidentDistanceMeters]);

  const handleToggleFollow = useCallback(() => {
    const next = !isFollowingUser;
    if (!next && isMovingBearingEnabled) {
      setMovingBearingEnabled(false);
    }
    setIsFollowingUser(next);
  }, [isFollowingUser, isMovingBearingEnabled, setMovingBearingEnabled, setIsFollowingUser]);

  const renderMode = 'normal';
  const androidRenderMode = 'normal';

  // Route line color based on theme - made stronger and more vibrant
  const routeColor = isDarkMode ? '#38bdf8' : '#2563eb';
  const routeCasingColor = isDarkMode ? '#0f172a' : '#1e3a8a';

  const visibleRouteGeometry = useMemo<RouteGeometry | null>(() => {
    if (!routeGeometry) return null;
    if (!userLocation) return routeGeometry;
    return trimRouteToCurrentLocation(routeGeometry, userLocation);
  }, [routeGeometry, userLocation]);

  const hasRouteLine = !!visibleRouteGeometry?.coordinates?.length;

  const routeSourceId = `route-source-${routeVersion}-${isFullscreen ? 'full' : 'norm'}`;
  const routeLineId = `route-line-${routeVersion}-${isFullscreen ? 'full' : 'norm'}`;
  const responderMarkerSourceId = `responder-marker-source-${isFullscreen ? 'full' : 'norm'}`;
  const responderMarkerLayerId = `responder-marker-layer-${isFullscreen ? 'full' : 'norm'}`;

  return (
    <>
      <MapView
        style={{ flex: 1 }}
        mapStyle={currentMapStyle}
        surfaceView={true}
        preferredFramesPerSecond={30}
        regionWillChangeDebounceTime={100}
        regionDidChangeDebounceTime={500}
        onDidFailLoadingMap={() => {
          setUseFallbackMapStyle(true);
        }}
        onPress={onMapPress}
        onLongPress={onMapRelease}
        onRegionWillChange={(feature) => {
          const props = (feature as any)?.properties ?? {};
          const rawIsUserInteraction = props.userInteraction ?? props.isUserInteraction;
          const isUserInteraction =
            rawIsUserInteraction === true ||
            rawIsUserInteraction === 'true' ||
            rawIsUserInteraction === 1;

          if (isUserInteraction) {
            isUserInteractingRef.current = true;
            setIsFollowingUser(false);
            if (isMovingBearingEnabled) {
              setMovingBearingEnabled(false);
            }
          }
        }}
        onRegionDidChange={() => {
          isUserInteractingRef.current = false;
        }}
        compassEnabled={!isMovingBearingActive}
        compassViewPosition={0}
        compassViewMargins={{ x: 16, y: 18 }}
        logoEnabled={false}
        zoomEnabled={true}
        scrollEnabled={true}>
        <Camera
          defaultSettings={{
            centerCoordinate: initialCenter ?? [124.02982096568188, 12.706220102613308],
            zoomLevel: 16,
          }}
          followUserLocation={isFollowingUser && hasLocationPermission}
          followUserMode={
            isFollowingUser && hasLocationPermission
              ? isMovingBearingActive
                ? UserTrackingMode.FollowWithHeading
                : UserTrackingMode.Follow
              : undefined
          }
        />
        {hasLocationPermission && (
          <UserLocation
            visible={true}
            renderMode={renderMode}
            androidRenderMode={androidRenderMode as any}
            showsUserHeadingIndicator={false}
            onUpdate={handleCameraUserLocationChange}
          />
        )}

        {/* Register the bundled marker image once, before its source/layer moves. */}
        <Images images={responderMarkerImages} />

        {/* Walking Route Polyline */}
        {visibleRouteGeometry && visibleRouteGeometry.coordinates.length > 0 && (
          <ShapeSource
            id={routeSourceId}
            shape={{
              type: 'FeatureCollection',
              features: [
                {
                  type: 'Feature',
                  properties: {},
                  geometry: visibleRouteGeometry,
                },
              ],
            }}
            lineMetrics={true}>
            {/* Route Casing (Border / Shadow) to make it pop against the map */}
            <LineLayer
              id={`${routeLineId}-casing`}
              style={{
                lineColor: isRerouting ? '#b45309' : routeCasingColor,
                lineWidth: 12,
                lineOpacity: isRerouting ? 0.4 : 0.9,
                lineJoin: 'round',
                lineCap: 'round',
              }}
            />
            {/* Main Route Line (Stronger and solid for high visibility) */}
            <LineLayer
              id={routeLineId}
              style={{
                lineColor: isRerouting ? '#f59e0b' : routeColor,
                lineWidth: 8,
                lineOpacity: isRerouting ? 0.6 : 1.0,
                lineJoin: 'round',
                lineCap: 'round',
              }}
            />
          </ShapeSource>
        )}

        {/*
          SymbolLayer is intentional here: it updates one map feature in place
          from the same latest GPS point used by the camera.
        */}
        {userLocation && (
          <ShapeSource
            ref={responderMarkerSourceRef}
            id={responderMarkerSourceId}
            shape={{
              type: 'Feature',
              properties: {},
              geometry: {
                type: 'Point',
                coordinates: [userLocation.longitude, userLocation.latitude],
              },
            }}>
            <SymbolLayer
              id={responderMarkerLayerId}
              style={{
                iconImage: responderMarkerImageName,
                iconSize: 0.12,
                iconRotationAlignment: 'map',
                iconRotate: deviceHeading,
                iconAllowOverlap: true,
                iconIgnorePlacement: true,
              }}
            />
          </ShapeSource>
        )}

        {/* Incident Destination Marker - Red */}
        {incident?.id && normalizedIncident && (
          <MarkerView
            key={`destination-${incident.id}-${isDarkMode ? 'dark' : 'light'}-${isFullscreen ? 'full' : 'norm'}`}
            coordinate={[normalizedIncident.lng, normalizedIncident.lat]}
            allowOverlap={true}
            anchor={{ x: 0.5, y: 0.5 }}>
            <View
              style={{
                width: 60,
                height: 60,
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                zIndex: 9999,
              }}>
              {/* Pulsing Circle Ping — Ring 1 */}
              <Animated.View
                style={{
                  position: 'absolute',
                  width: 50,
                  height: 50,
                  borderRadius: 25,
                  backgroundColor: 'rgba(239, 68, 68, 0.35)',
                  borderWidth: 2,
                  borderColor: '#ef4444',
                  transform: [{ scale: pulseScale }],
                  opacity: pulseOpacity,
                }}
              />
              {/* Pulsing Circle Ping — Ring 2 (staggered) */}
              <Animated.View
                style={{
                  position: 'absolute',
                  width: 50,
                  height: 50,
                  borderRadius: 25,
                  backgroundColor: 'rgba(239, 68, 68, 0.2)',
                  borderWidth: 1.5,
                  borderColor: '#f87171',
                  transform: [{ scale: pulseScale2 }],
                  opacity: pulseOpacity2,
                }}
              />
              <Image
                source={require('../assets/reportMarker.gif')}
                style={{ width: 26, height: 26, resizeMode: 'contain', zIndex: 2 }}
              />
            </View>
          </MarkerView>
        )}
      </MapView>

      {/* Route loading spinner (center) */}
      {isRouteLoading && !hasRouteLine && (
        <View pointerEvents="none" style={styles.routeLoadingOverlay}>
          <View style={[styles.routeLoadingBox, isDarkMode && styles.routeLoadingBoxDark]}>
            <ActivityIndicator size="large" color={isDarkMode ? '#38bdf8' : '#2563eb'} />
          </View>
        </View>
      )}

      {!!routeError && (
        <View style={styles.routeErrorBanner} pointerEvents="none">
          <Text style={styles.routeErrorText}>{routeError}</Text>
        </View>
      )}

      {/* User Address Display */}
      {/* <View style={[styles.addressContainer, isDarkMode && styles.addressContainerDark]}>
        <Icon name="location" size={16} color={isDarkMode ? '#60a5fa' : '#3b82f6'} />
        <Text style={[styles.addressText, isDarkMode && styles.addressTextDark]} numberOfLines={2}>
          {userAddress}
        </Text>
      </View> */}

      {/* Route Loading Indicator */}
      {/* {isRouteLoading && (
        <View style={[styles.routeLoading, isDarkMode && styles.routeLoadingDark]}>
          <Text style={[styles.routeLoadingText, isDarkMode && styles.routeLoadingTextDark]}>
            Fetching route...
          </Text>
        </View>
      )} */}

      <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
        {permissionMessage && (
          <View style={styles.permissionError}>
            <Text style={styles.permissionErrorText}>{permissionMessage}</Text>
          </View>
        )}

        {/* Rerouting indicator */}
        {isRerouting && (
          <View style={styles.reroutingBanner}>
            <Text style={styles.reroutingText}>↺ Rerouting...</Text>
          </View>
        )}

        {/* {isMovingBearingActive && (
        <View pointerEvents="none" style={styles.bearingPointerContainer}>
          <View style={[styles.bearingPointerBadge, isDarkMode && styles.bearingPointerBadgeDark]}>
            <View style={styles.bearingPointerIcon}>
              <Icon name="send" size={18} color="#FFFFFF" />
            </View>
          </View>
        </View>
      )} */}

        {/* <TouchableOpacity
          style={[
            styles.bearingButton,
            isDarkMode && styles.bearingButtonDark,
            isMovingBearingEnabled && styles.bearingButtonActive,
          ]}
          activeOpacity={0.9}
          onPress={handleToggleMovingBearing}>
          <View
            style={[
              styles.bearingButtonIconWrap,
              isMovingBearingEnabled && styles.bearingButtonIconWrapActive,
            ]}>
            <View style={styles.bearingButtonIcon}>
              <Icon name="send" size={16} color="#FFFFFF" />
            </View>
          </View>
        </TouchableOpacity> */}

        {/* Follow User Toggle */}
        <TouchableOpacity
          style={[
            styles.followButton,
            { bottom: 30 + fullscreenBottomInset },
            isDarkMode && styles.followButtonDark,
            !isFollowingUser && styles.followButtonInactive,
          ]}
          onPress={handleToggleFollow}>
          <Icon name="my-location" size={20} color="#fff" />
        </TouchableOpacity>

        {/* Route profile toggle buttons (Driving / foot) */}
        {incident?.id && normalizedIncident && (
          <View style={[styles.routeProfileButtons, { bottom: 146 + fullscreenBottomInset }]}>
            <TouchableOpacity
              style={[
                styles.routeProfileButton,
                isDarkMode && styles.routeProfileButtonDark,
                routeProfile === 'driving' && styles.routeProfileButtonActive,
              ]}
              onPress={() => handleSetRouteProfile('driving')}>
              <Icon
                name="car"
                size={20}
                color={routeProfile === 'driving' ? '#fff' : isDarkMode ? '#fff' : '#333'}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.routeProfileButton,
                isDarkMode && styles.routeProfileButtonDark,
                routeProfile === 'foot' && styles.routeProfileButtonActive,
              ]}
              onPress={() => handleSetRouteProfile('foot')}>
              <Icon
                name="walk"
                size={20}
                color={routeProfile === 'foot' ? '#fff' : isDarkMode ? '#fff' : '#333'}
              />
            </TouchableOpacity>
          </View>
        )}

        {/* Fullscreen Toggle Button */}
        {onToggleFullscreen && showFullscreenToggle && (
          <TouchableOpacity
            style={[
              styles.fullscreenButton,
              { bottom: 90 + fullscreenBottomInset },
              isDarkMode && styles.fullscreenButtonDark,
            ]}
            onPress={onToggleFullscreen}>
            <Icon
              name={isFullscreen ? 'fullscreen-exit' : 'fullscreen'}
              size={20}
              color={isDarkMode ? '#fff' : '#333'}
            />
          </TouchableOpacity>
        )}
      </View>
    </>
  );
});

const styles = StyleSheet.create({
  addressContainer: {
    position: 'absolute',
    top: 90,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    padding: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  addressContainerDark: {
    backgroundColor: 'rgba(30, 30, 46, 0.95)',
  },
  addressText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 12,
    color: '#333',
  },
  addressTextDark: {
    color: '#e0e0e0',
  },
  routeLoading: {
    position: 'absolute',
    top: 110,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  routeLoadingDark: {
    backgroundColor: 'rgba(30, 30, 46, 0.95)',
  },
  routeLoadingText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  routeLoadingTextDark: {
    color: '#e0e0e0',
  },
  followButton: {
    position: 'absolute',
    bottom: 30,
    right: 16,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  followButtonDark: {
    backgroundColor: '#2563eb',
  },
  followButtonInactive: {
    backgroundColor: '#9ca3af',
  },
  incidentMarker: {
    width: 24,
    height: 24,
    borderRadius: 16,
    backgroundColor: '#ef4444', // Red for incident
    borderWidth: 3,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
  },
  incidentMarkerInner: {
    width: 6,
    height: 6,
    borderRadius: 6,
    backgroundColor: '#fff',
  },
  destinationMarker: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#2E7DFF',
    borderWidth: 3,
    borderColor: '#0B4DCC',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
  },
  destinationMarkerInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E8F1FF',
  },
  fullscreenButton: {
    position: 'absolute',
    bottom: 90,
    right: 16,
    width: 46,
    height: 46,
    borderRadius: 46,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  fullscreenButtonDark: {
    backgroundColor: 'rgba(50, 50, 70, 0.9)',
  },
  routeProfileButtons: {
    position: 'absolute',
    right: 16,
    bottom: 146, // stacked above the fullscreen button
    gap: 10,
  },
  routeProfileButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  routeProfileButtonDark: {
    backgroundColor: 'rgba(50, 50, 70, 0.9)',
  },
  routeProfileButtonActive: {
    backgroundColor: '#2563eb',
  },
  routeInfo: {
    position: 'absolute',
    bottom: 80,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  routeInfoText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    color: '#333',
  },
  loadingOverlay: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingBox: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
  },
  loadingText: {
    fontSize: 16,
    color: '#333',
  },
  retryButton: {
    position: 'absolute',
    bottom: 150,
    left: '50%',
    transform: [{ translateX: -100 }],
    backgroundColor: '#FFA500',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  permissionError: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(255, 0, 0, 0.8)',
    padding: 12,
    borderRadius: 8,
  },
  permissionErrorText: {
    color: 'white',
    fontSize: 14,
    textAlign: 'center',
  },
  bearingPointerContainer: {
    position: 'absolute',
    top: 72,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  bearingPointerBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.24,
    shadowRadius: 8,
    elevation: 6,
  },
  bearingPointerBadgeDark: {
    backgroundColor: 'rgba(37, 99, 235, 0.92)',
  },
  bearingPointerIcon: {
    transform: [{ rotate: '-90deg' }],
  },
  bearingButton: {
    position: 'absolute',
    top: 112,
    right: 16,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  bearingButtonDark: {
    backgroundColor: 'rgba(30, 41, 59, 0.94)',
  },
  bearingButtonActive: {
    backgroundColor: '#0F172A',
  },
  bearingButtonIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#64748B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bearingButtonIconWrapActive: {
    backgroundColor: '#2563EB',
  },
  bearingButtonIcon: {
    transform: [{ rotate: '-90deg' }],
  },
  tilePickerButton: {
    position: 'absolute',
    left: 16,
    right: 88,
    bottom: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  tilePickerButtonDark: {
    backgroundColor: 'rgba(30, 30, 46, 0.96)',
  },
  tilePickerIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tilePickerCopy: {
    flex: 1,
  },
  tilePickerLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tilePickerLabelDark: {
    color: '#94A3B8',
  },
  tilePickerValue: {
    marginTop: 1,
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  tilePickerValueDark: {
    color: '#F8FAFC',
  },
  annotationContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseOuter: {
    position: 'absolute',
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(248, 137, 33, 0.08)',
  },
  pulseMiddle: {
    position: 'absolute',
    width: 35,
    height: 35,
    borderRadius: 17.5,
    backgroundColor: 'rgba(248, 135, 30, 0.32)',
  },
  markerDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FC8B0A',
    borderWidth: 3,
    borderColor: '#CF7208',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
  },
  markerInnerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FC8600',
  },
  actionButtonsContainer: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 88,
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  reroutingBanner: {
    position: 'absolute',
    top: 60,
    alignSelf: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.95)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
  },
  reroutingText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  routeLoadingOverlay: {
    position: 'absolute',
    inset: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  routeLoadingBox: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  routeLoadingBoxDark: {
    backgroundColor: 'rgba(15, 23, 42, 0.86)',
  },
  routeErrorBanner: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(239, 68, 68, 0.92)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 5,
  },
  routeErrorText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
});

export default MapScreen;
