import React, { memo, useEffect, useState, useCallback, useMemo } from 'react';
import { StyleSheet, View, Text, Pressable } from 'react-native';
import { Incident } from '../src/types';
import {
  MapView,
  UserLocation,
  Camera,
  PointAnnotation,
  ShapeSource,
  LineLayer,
} from '@maplibre/maplibre-react-native';
import * as Speech from 'expo-speech';
import { locationService, type LocationCoords } from './services/locationService';
import { useRouteStore } from './routeStore';
import { Icon } from './Icon';

// Free MapLibre style using CartoDB Positron tiles (no API key required)
const CARTO_DB_STYLE = {
  version: 8,
  sources: {
    cartodb: {
      type: 'raster',
      tiles: [
        'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
        'https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
        'https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
      ],
      tileSize: 256,
    },
  },
  layers: [
    {
      id: 'carto-basemap',
      type: 'raster',
      source: 'cartodb',
      minzoom: 0,
    },
  ],
};

const CARTO_DB_DARK_STYLE = {
  version: 8,
  sources: {
    cartodb: {
      type: 'raster',
      tiles: [
        'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
        'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
        'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
      ],
      tileSize: 256,
    },
  },
  layers: [
    {
      id: 'carto-basemap',
      type: 'raster',
      source: 'cartodb',
      minzoom: 0,
    },
  ],
};

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

const getStepInstruction = (step: RouteStep) => {
  if (step.instruction) return step.instruction;
  const modifier = step.modifier?.toLowerCase();
  if (modifier === 'left') return 'Turn left';
  if (modifier === 'right') return 'Turn right';
  if (modifier === 'uturn') return 'Make a U-turn';
  if (modifier === 'straight') return 'Go straight';
  return 'Proceed';
};

const MapScreen = memo(function MapScreen({
  onMapPress,
  onMapRelease,
  isDarkMode,
  incident,
  onToggleFullscreen,
  isFullscreen,
  showFullscreenToggle = true,
}: MapScreenProps) {
  // Use dark or light map style based on isDarkMode
  const currentMapStyle = isDarkMode ? CARTO_DB_DARK_STYLE : CARTO_DB_STYLE;
  const [initialCenter, setInitialCenter] = useState<[number, number] | null>(null);
  const [userLocation, setUserLocation] = useState<LocationCoords | null>(null);
  const [userAddress, setUserAddress] = useState<string>('Getting location...');
  const routeGeometry = useRouteStore((state) => state.routeGeometry);
  const routeSteps = useRouteStore((state) => state.routeSteps);
  const isRouteLoading = useRouteStore((state) => state.isRouteLoading);
  const fetchRoute = useRouteStore((state) => state.fetchRoute);
  const clearRoute = useRouteStore((state) => state.clearRoute);
  const [routeVersion, setRouteVersion] = useState<number>(0);
  const [isFollowingUser, setIsFollowingUser] = useState<boolean>(true);
  const [nextStepIndex, setNextStepIndex] = useState<number>(0);

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

    locationService.getCurrentLocation().then((location) => {
      if (!isMounted) return;

      setUserLocation(location);
      fetchUserAddress(location.latitude, location.longitude);
      setInitialCenter([location.longitude, location.latitude]);
    });

    return () => {
      isMounted = false;
    };
  }, [fetchUserAddress]);

  const normalizedIncident = useMemo(
    () => normalizeIncidentCoords(incident?.coordinates),
    [incident?.coordinates?.lat, incident?.coordinates?.lng]
  );

  // Update route when incident location or user location changes
  useEffect(() => {
    if (incident?.id && normalizedIncident && userLocation) {
      const destLat = normalizedIncident.lat;
      const destLng = normalizedIncident.lng;

      fetchRoute({
        userLat: userLocation.latitude,
        userLng: userLocation.longitude,
        destLat,
        destLng,
      });
      setRouteVersion((prev) => prev + 1);
      setNextStepIndex(0);
    } else {
      clearRoute();
      setNextStepIndex(0);
      setRouteVersion((prev) => prev + 1);
    }
  }, [
    incident?.id,
    normalizedIncident?.lat,
    normalizedIncident?.lng,
    userLocation,
    fetchRoute,
    clearRoute,
    isFullscreen,
  ]);

  // Handle user location updates
  const handleCameraUserLocationChange = useCallback(
    (location: any) => {
      if (location && location.coords) {
        const { latitude, longitude } = location.coords;

        setUserLocation({ latitude, longitude });
        fetchUserAddress(latitude, longitude);
      }
    },
    [fetchUserAddress]
  );

  useEffect(() => {
    if (!userLocation || routeSteps.length === 0) return;
    if (nextStepIndex >= routeSteps.length) return;

    const step = routeSteps[nextStepIndex];
    if (!step?.location) return;

    const distance = distanceMeters([userLocation.longitude, userLocation.latitude], step.location);

    if (distance <= 30) {
      const text = getStepInstruction(step);
      Speech.speak(text);
      setNextStepIndex((prev) => prev + 1);
    }
  }, [userLocation, routeSteps, nextStepIndex]);

  const handleToggleFollow = useCallback(() => {
    setIsFollowingUser((prev) => !prev);
  }, []);

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
          if (feature?.properties?.isUserInteraction) {
            setIsFollowingUser(false);
          }
        }}
        compassEnabled={true}
        logoEnabled={false}
        zoomEnabled={true}
        scrollEnabled={true}>
        <Camera
          defaultSettings={{
            centerCoordinate: initialCenter ?? [124.02982096568188, 12.706220102613308],
            zoomLevel: 16,
          }}
          followUserLocation={isFollowingUser}
        />
        <UserLocation
          visible={true}
          renderMode={renderMode}
          androidRenderMode={androidRenderMode}
          showsUserHeadingIndicator={true}
          onUpdate={handleCameraUserLocationChange}
        />

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
                lineColor: routeColor,
                lineWidth: 4,
                lineOpacity: 0.8,
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
      <View style={[styles.addressContainer, isDarkMode && styles.addressContainerDark]}>
        <Icon name="location" size={16} color={isDarkMode ? '#60a5fa' : '#3b82f6'} />
        <Text style={[styles.addressText, isDarkMode && styles.addressTextDark]} numberOfLines={2}>
          {userAddress}
        </Text>
      </View>

      {/* Route Loading Indicator */}
      {isRouteLoading && (
        <View style={[styles.routeLoading, isDarkMode && styles.routeLoadingDark]}>
          <Text style={[styles.routeLoadingText, isDarkMode && styles.routeLoadingTextDark]}>
            Fetching route...
          </Text>
        </View>
      )}

      {/* Follow User Toggle */}
      <Pressable
        style={[
          styles.followButton,
          isDarkMode && styles.followButtonDark,
          !isFollowingUser && styles.followButtonInactive,
        ]}
        onPress={handleToggleFollow}>
        <Icon name="my-location" size={20} color="#fff" />
      </Pressable>

      {/* Fullscreen Toggle Button */}
      {onToggleFullscreen && showFullscreenToggle && (
        <Pressable
          style={[styles.fullscreenButton, isDarkMode && styles.fullscreenButtonDark]}
          onPress={onToggleFullscreen}>
          <Icon
            name={isFullscreen ? 'fullscreen-exit' : 'fullscreen'}
            size={20}
            color={isDarkMode ? '#fff' : '#333'}
          />
        </Pressable>
      )}
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
    bottom: 80,
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
    bottom: 30,
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
});

export default MapScreen;
