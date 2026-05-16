import React, { memo, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { StyleSheet, View, TouchableOpacity, Vibration, Text } from 'react-native';
import { Incident } from '../src/types';
import {
  MapView,
  UserLocation,
  Camera,
  type CameraRef,
  PointAnnotation,
  ShapeSource,
  LineLayer,
  UserTrackingMode,
} from '@maplibre/maplibre-react-native';
import { locationService, type LocationCoords } from './services/locationService';
import { useRouteStore } from './routeStore';
import { Icon } from './Icon';

const createRasterMapStyle = (
  sourceId: string,
  layerId: string,
  tiles: string[],
  maxzoom?: number
) => ({
  version: 8,
  sources: {
    [sourceId]: {
      type: 'raster',
      tiles,
      tileSize: 256,
      ...(typeof maxzoom === 'number' ? { maxzoom } : {}),
    },
  },
  layers: [
    {
      id: layerId,
      type: 'raster',
      source: sourceId,
      minzoom: 0,
    },
  ],
});

const ARRIVAL_VIBRATION_PATTERN = [0, 220, 140, 220, 140, 220, 140, 220, 140, 220];

// Free raster basemaps for the responder map (no API key required)
const OPEN_STREET_MAP_STYLE = createRasterMapStyle(
  'osm',
  'osm-basemap',
  ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
  19
);

// OSM Nominatim API for reverse geocoding
const OSM_REVERSE_GEOCODE_URL = 'https://nominatim.openstreetmap.org/reverse';

interface MapScreenProps {
  onMapPress?: () => void;
  onMapRelease?: () => void;
  isDarkMode: boolean;
  incident?: Incident | null;
  onToggleFullscreen?: () => void;
  isFullscreen?: boolean;
  showFullscreenToggle?: boolean;
  isMovingBearingEnabled?: boolean;
  onMovingBearingChange?: (enabled: boolean) => void;
}

interface RouteStep {
  location: [number, number];
  instruction?: string;
  modifier?: string;
  type?: string;
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
const distanceToPolyline = (
  point: [number, number],
  polyline: [number, number][]
): number => {
  if (polyline.length === 0) return Infinity;
  if (polyline.length === 1) return distanceMeters(point, polyline[0]);

  let minDist = Infinity;

  for (let i = 0; i < polyline.length - 1; i++) {
    const A = polyline[i];
    const B = polyline[i + 1];

    // Project point P onto segment AB, get closest point on segment
    const ax = A[0], ay = A[1];
    const bx = B[0], by = B[1];
    const px = point[0], py = point[1];

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

// How far (meters) off-route before triggering a reroute
const OFF_ROUTE_THRESHOLD_M = 35;
// How many consecutive off-route checks before actually rerouting (avoids GPS jitter false positives)
const OFF_ROUTE_CONSECUTIVE_CHECKS = 3;

const MapScreen = memo(function MapScreen({
  onMapPress,
  onMapRelease,
  isDarkMode,
  incident,
  onToggleFullscreen,
  isFullscreen,
  showFullscreenToggle = true,
  isMovingBearingEnabled: isMovingBearingEnabledProp,
  onMovingBearingChange,
}: MapScreenProps) {
  const [initialCenter, setInitialCenter] = useState<[number, number] | null>(null);
  const [userLocation, setUserLocation] = useState<LocationCoords | null>(null);
  const [, setUserAddress] = useState<string>('Getting location...');
  const [hasLocationPermission, setHasLocationPermission] = useState(false);
  const [permissionMessage, setPermissionMessage] = useState<string | null>(null);
  const routeGeometry = useRouteStore((state) => state.routeGeometry);
  const routeSteps = useRouteStore((state) => state.routeSteps);
  const fetchRoute = useRouteStore((state) => state.fetchRoute);
  const clearRoute = useRouteStore((state) => state.clearRoute);
  const [routeVersion, setRouteVersion] = useState<number>(0);
  const [isFollowingUser, setIsFollowingUser] = useState<boolean>(true);
  const [isMovingBearingEnabledLocal, setIsMovingBearingEnabledLocal] = useState<boolean>(false);
  const isMovingBearingEnabled = isMovingBearingEnabledProp ?? isMovingBearingEnabledLocal;
  const isMovingBearingActive = isMovingBearingEnabled && isFollowingUser && hasLocationPermission;
  const [arrivalAlertIncidentId, setArrivalAlertIncidentId] = useState<Incident['id'] | null>(null);
  const [nextStepIndex, setNextStepIndex] = useState<number>(0);
  const [isRerouting, setIsRerouting] = useState(false);
  const cameraRef = useRef<CameraRef | null>(null);
  const lastMovingBearingCameraUpdateMsRef = useRef<number>(0);
  // Tracks consecutive off-route GPS checks to avoid false positives from jitter
  const offRouteCountRef = useRef<number>(0);
  // Stores the destination coordinates for rerouting without incident dependency
  const destCoordsRef = useRef<{ lat: number; lng: number } | null>(null);
  // Prevents simultaneous reroute fetches
  const isReroutingRef = useRef(false);

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

      const location = granted
        ? await locationService.getCurrentLocation()
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
  const incidentDistanceMeters = useMemo(() => {
    if (!userLocation || !normalizedIncident) return null;

    return distanceMeters(
      [userLocation.longitude, userLocation.latitude],
      [normalizedIncident.lng, normalizedIncident.lat]
    );
  }, [normalizedIncident, userLocation]);

  const currentMapStyle = useMemo(() => {
    return OPEN_STREET_MAP_STYLE;
  }, []);



  // Fetch initial route ONLY when incident changes — NOT on every userLocation update.
  // Re-routing on deviation is handled separately by the off-route detector below.
  useEffect(() => {
    if (incident?.id && normalizedIncident && userLocation) {
      const destLat = normalizedIncident.lat;
      const destLng = normalizedIncident.lng;

      // Store destination for later rerouting without re-subscribing to incident
      destCoordsRef.current = { lat: destLat, lng: destLng };
      offRouteCountRef.current = 0;

      fetchRoute({
        userLat: userLocation.latitude,
        userLng: userLocation.longitude,
        destLat,
        destLng,
      });
      setRouteVersion((prev) => prev + 1);
      setNextStepIndex(0);
    } else {
      destCoordsRef.current = null;
      offRouteCountRef.current = 0;
      clearRoute();
      setNextStepIndex(0);
      setRouteVersion((prev) => prev + 1);
    }
  // Only re-fetch on incident change — not on userLocation change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incident?.id, normalizedIncident?.lat, normalizedIncident?.lng]);

  // Handle user location updates
  const handleCameraUserLocationChange = useCallback(
    (location: any) => {
      if (location && location.coords) {
        const { latitude, longitude, heading } = location.coords;

        console.log('[MapScreen] Location update:', {
          lat: latitude,
          lng: longitude,
          heading: heading,
          headingType: typeof heading,
          isValidHeading: typeof heading === 'number' && !isNaN(heading),
        });

        setUserLocation({ latitude, longitude, heading });
        fetchUserAddress(latitude, longitude);

        // Send location with heading to server
        if (typeof heading === 'number' && !isNaN(heading)) {
          console.log(`[MapScreen] Sending location with heading: ${heading}°`);
          locationService.sendLocationWithHeading({ latitude, longitude }, heading).catch((error) => {
            console.log('[MapScreen] Failed to send location with heading:', error);
          });
        } else {
          console.log(`[MapScreen] No valid heading to send (value: ${heading})`);
        }

        if (isMovingBearingActive) {
          const now = Date.now();
          if (now - lastMovingBearingCameraUpdateMsRef.current >= 250) {
            lastMovingBearingCameraUpdateMsRef.current = now;

            console.log(`[MapScreen] Updating camera with heading: ${heading}°`);
            cameraRef.current?.setCamera({
              centerCoordinate: [longitude, latitude],
              heading,
              animationDuration: 250,
            });
          }
        }
      }
    },
    [fetchUserAddress, isMovingBearingActive]
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
      console.log(`[Reroute] Off-route: ${deviation.toFixed(0)}m (check ${offRouteCountRef.current}/${OFF_ROUTE_CONSECUTIVE_CHECKS})`);

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
        }).then(() => {
          isReroutingRef.current = false;
          setIsRerouting(false);
          setRouteVersion((prev) => prev + 1);
          setNextStepIndex(0);
          console.log('[Reroute] New route calculated successfully.');
        }).catch(() => {
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
    Vibration.cancel();
    Vibration.vibrate(ARRIVAL_VIBRATION_PATTERN, false);
    setArrivalAlertIncidentId(incident.id);
  }, [arrivalAlertIncidentId, incident?.id, incidentDistanceMeters]);

  const handleToggleFollow = useCallback(() => {
    setIsFollowingUser((prev) => !prev);
  }, []);

  const recenterToUser = useCallback(() => {
    if (!userLocation) return;
    cameraRef.current?.setCamera({
      centerCoordinate: [userLocation.longitude, userLocation.latitude],
      animationDuration: 450,
    });
  }, [userLocation]);

  const handleToggleMovingBearing = useCallback(() => {
    if (!hasLocationPermission) {
      setPermissionMessage('Location permission is required to use heading mode.');
      return;
    }

    if (isMovingBearingEnabled && !isFollowingUser) {
      setIsFollowingUser(true);
      recenterToUser();
      return;
    }

    const next = !isMovingBearingEnabled;
    if (next) {
      setIsFollowingUser(true);
      recenterToUser();
    }

    if (onMovingBearingChange) {
      onMovingBearingChange(next);
    } else {
      setIsMovingBearingEnabledLocal(next);
    }
  }, [
    hasLocationPermission,
    isMovingBearingEnabled,
    isFollowingUser,
    onMovingBearingChange,
    recenterToUser,
  ]);

  const renderMode = 'native';
  const androidRenderMode = undefined;

  // Route line color based on theme
  const routeColor = isDarkMode ? '#60a5fa' : '#3b82f6';

  const routeSourceId = `route-source-${routeVersion}-${isFullscreen ? 'full' : 'norm'}`;
  const routeLineId = `route-line-${routeVersion}-${isFullscreen ? 'full' : 'norm'}`;

  return (
    <>
      <MapView
        key={`map-${isFullscreen ? 'full' : 'norm'}`}
        style={{ flex: 1 }}
        mapStyle={currentMapStyle}
        onPress={onMapPress}
        onLongPress={onMapRelease}
        onRegionWillChange={(feature) => {
          const rawIsUserInteraction = (feature as any)?.properties?.isUserInteraction;
          const isUserInteraction =
            rawIsUserInteraction === true ||
            rawIsUserInteraction === 'true' ||
            rawIsUserInteraction === 1;

          if (isUserInteraction) {
            setIsFollowingUser(false);
          }
        }}
        compassEnabled={!isMovingBearingActive}
        compassViewPosition={0}
        compassViewMargins={{ x: 16, y: 18 }}
        logoEnabled={false}
        zoomEnabled={true}
        scrollEnabled={true}>
        <Camera
          ref={cameraRef}
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
            androidRenderMode={androidRenderMode}
            showsUserHeadingIndicator={!isMovingBearingActive}
            onUpdate={handleCameraUserLocationChange}
          />
        )}

        {/* Walking Route Polyline */}
        {routeGeometry && (
          <ShapeSource
            id={routeSourceId}
            key={routeSourceId}
            shape={{
              type: 'Feature',
              properties: {},
              geometry: routeGeometry,
            }}
            lineMetrics={true}>
            <LineLayer
              id={routeLineId}
              style={{
                lineColor: isRerouting ? '#f59e0b' : routeColor,
                lineWidth: 4,
                lineOpacity: isRerouting ? 0.5 : 0.8,
                lineDasharray: [2, 1],
              }}
            />
          </ShapeSource>
        )}

        {/* Incident Destination Marker - Red */}
        {incident?.id && normalizedIncident && (
          <PointAnnotation
            id="destination-marker"
            key={`destination-${incident.id}-${isDarkMode ? 'dark' : 'light'}-${isFullscreen ? 'full' : 'norm'}`}
            coordinate={[normalizedIncident.lng, normalizedIncident.lat]}
            draggable={false}>
            <View style={styles.incidentMarker}>
              <Icon name="my-location" size={4} color="#fff" />
            </View>
          </PointAnnotation>
        )}
      </MapView>

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
            <Text style={styles.reroutingText}>↺  Rerouting...</Text>
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

        <TouchableOpacity
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
        </TouchableOpacity>

        {/* Follow User Toggle */}
        <TouchableOpacity
          style={[
            styles.followButton,
            isDarkMode && styles.followButtonDark,
            !isFollowingUser && styles.followButtonInactive,
          ]}
          onPress={handleToggleFollow}>
          <Icon name="my-location" size={20} color="#fff" />
        </TouchableOpacity>

        {/* Fullscreen Toggle Button */}
        {onToggleFullscreen && showFullscreenToggle && (
          <TouchableOpacity
            style={[styles.fullscreenButton, isDarkMode && styles.fullscreenButtonDark]}
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
});

export default MapScreen;
