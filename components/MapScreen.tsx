import React, { memo, useEffect, useState, useCallback, useMemo } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Vibration } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Incident } from '../src/types';
import {
  MapView,
  UserLocation,
  Camera,
  PointAnnotation,
  ShapeSource,
  LineLayer,
  UserTrackingMode,
} from '@maplibre/maplibre-react-native';
import * as Speech from 'expo-speech';
import { locationService, type LocationCoords } from './services/locationService';
import { useRouteStore } from './routeStore';
import { Icon } from './Icon';
import {
  MapTileSelectorModal,
  type MapLayerKey,
  type MapTileOption,
} from './MapTileSelectorModal';

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

const MAP_LAYER_STORAGE_KEY = 'responder:selectedMapLayer';
const ARRIVAL_VIBRATION_PATTERN = [0, 220, 140, 220, 140, 220, 140, 220, 140, 220];
const MAP_LAYER_KEYS: MapLayerKey[] = [
  'standard',
  'osm',
  'maptilerStreets',
  'tracestrackDefault',
  'tracestrackEnglish',
  'tracestrackLocalized',
  'stadiaDark',
  'terrain',
  'satellite',
];

const MAP_LAYER_OPTIONS: MapTileOption[] = [
  {
    key: 'standard',
    label: 'Carto Street',
    subtitle: 'Road-focused',
    description: 'Best for dispatching through roads, intersections, and barangay navigation.',
    accent: '#2563EB',
    previewColors: ['#DCEAFE', '#93C5FD', '#60A5FA'],
  },
  {
    key: 'osm',
    label: 'OpenStreetMap',
    subtitle: 'Community tiles',
    description: 'Direct OpenStreetMap raster tiles for a familiar open-data road basemap.',
    accent: '#0F766E',
    previewColors: ['#CCFBF1', '#5EEAD4', '#14B8A6'],
  },
  {
    key: 'maptilerStreets',
    label: 'MapTiler Streets',
    subtitle: 'Provider streets',
    description: 'MapTiler street basemap endpoint added as requested.',
    accent: '#7C3AED',
    previewColors: ['#EDE9FE', '#C4B5FD', '#8B5CF6'],
    availabilityHint: 'Unavailable right now: the provided URL responds with HTTP 403.',
  },
  {
    key: 'tracestrackDefault',
    label: 'Tracestrack Default',
    subtitle: 'Outdoor base',
    description: 'Tracestrack default tile path with the underscore locale route.',
    accent: '#A16207',
    previewColors: ['#FEF3C7', '#FCD34D', '#F59E0B'],
    availabilityHint: 'Unavailable right now: the provided URL responds with HTTP 403.',
  },
  {
    key: 'tracestrackEnglish',
    label: 'Tracestrack EN',
    subtitle: 'English labels',
    description: 'English-labeled Tracestrack tile path for outdoor and route context.',
    accent: '#B45309',
    previewColors: ['#FFEDD5', '#FDBA74', '#F97316'],
    availabilityHint: 'Unavailable right now: the provided URL responds with HTTP 403.',
  },
  {
    key: 'tracestrackLocalized',
    label: 'Tracestrack Localized',
    subtitle: 'Language variants',
    description:
      'Represents the Tracestrack language-specific paths such as ar, de, fr, th, and zh-hans.',
    accent: '#BE123C',
    previewColors: ['#FFE4E6', '#FDA4AF', '#F43F5E'],
    availabilityHint:
      'Unavailable right now: the localized sample path also responds with HTTP 403, and the bracketed URL needs a concrete language code.',
  },
  {
    key: 'stadiaDark',
    label: 'Stadia Dark',
    subtitle: 'Dark tile set',
    description: 'Stadia Maps alidade smooth dark endpoint added as requested.',
    accent: '#334155',
    previewColors: ['#CBD5E1', '#64748B', '#1E293B'],
    availabilityHint: 'Unavailable right now: the provided URL responds with HTTP 401.',
  },
  {
    key: 'terrain',
    label: 'Terrain',
    subtitle: 'Elevation context',
    description: 'Useful when you need slope and topography context for field access decisions.',
    accent: '#16A34A',
    previewColors: ['#DCFCE7', '#86EFAC', '#4ADE80'],
  },
  {
    key: 'satellite',
    label: 'Satellite',
    subtitle: 'Aerial view',
    description: 'Shows real-world surface detail for structures, open areas, and landmarks.',
    accent: '#F97316',
    previewColors: ['#FED7AA', '#FDBA74', '#FB923C'],
  },
];

// Free raster basemaps for the responder map (no API key required)
const CARTO_DB_STYLE = createRasterMapStyle('cartodb-light', 'carto-light-basemap', [
  'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
  'https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
  'https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
]);

const CARTO_DB_DARK_STYLE = createRasterMapStyle('cartodb-dark', 'carto-dark-basemap', [
  'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
  'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
  'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
]);

const OPEN_TOPO_STYLE = createRasterMapStyle(
  'opentopo',
  'opentopo-basemap',
  [
    'https://a.tile.opentopomap.org/{z}/{x}/{y}.png',
    'https://b.tile.opentopomap.org/{z}/{x}/{y}.png',
    'https://c.tile.opentopomap.org/{z}/{x}/{y}.png',
  ],
  17
);

const SATELLITE_STYLE = createRasterMapStyle(
  'satellite',
  'satellite-basemap',
  ['https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
  19
);

const OPEN_STREET_MAP_STYLE = createRasterMapStyle(
  'osm',
  'osm-basemap',
  ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
  19
);

const MAPTILER_STREETS_STYLE = createRasterMapStyle(
  'maptiler-streets',
  'maptiler-streets-basemap',
  ['https://api.maptiler.com/maps/streets/{z}/{x}/{y}.png'],
  22
);

const TRACESTRACK_DEFAULT_STYLE = createRasterMapStyle(
  'tracestrack-default',
  'tracestrack-default-basemap',
  ['https://tile.tracestrack.com/_/{z}/{x}/{y}.png'],
  19
);

const TRACESTRACK_ENGLISH_STYLE = createRasterMapStyle(
  'tracestrack-english',
  'tracestrack-english-basemap',
  ['https://tile.tracestrack.com/en/{z}/{x}/{y}.png'],
  19
);

const TRACESTRACK_LOCALIZED_STYLE = createRasterMapStyle(
  'tracestrack-localized',
  'tracestrack-localized-basemap',
  ['https://tile.tracestrack.com/th/{z}/{x}/{y}.png'],
  19
);

const STADIA_DARK_STYLE = createRasterMapStyle(
  'stadia-dark',
  'stadia-dark-basemap',
  ['https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}.png'],
  20
);

const DEFAULT_LAYER_AVAILABILITY: Record<MapLayerKey, boolean> = {
  standard: true,
  osm: true,
  maptilerStreets: false,
  tracestrackDefault: false,
  tracestrackEnglish: false,
  tracestrackLocalized: false,
  stadiaDark: false,
  terrain: true,
  satellite: true,
};

const TILE_PROBE_URLS: Partial<Record<MapLayerKey, string>> = {
  osm: 'https://tile.openstreetmap.org/1/1/1.png',
  maptilerStreets: 'https://api.maptiler.com/maps/streets/1/1/1.png',
  tracestrackDefault: 'https://tile.tracestrack.com/_/1/1/1.png',
  tracestrackEnglish: 'https://tile.tracestrack.com/en/1/1/1.png',
  tracestrackLocalized: 'https://tile.tracestrack.com/th/1/1/1.png',
  stadiaDark: 'https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/1/1/1.png',
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

const isTileEndpointAvailable = async (url: string) => {
  try {
    const response = await fetch(url);
    return response.ok;
  } catch {
    return false;
  }
};

const isMapLayerKey = (value: string): value is MapLayerKey =>
  MAP_LAYER_KEYS.includes(value as MapLayerKey);

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
  const [initialCenter, setInitialCenter] = useState<[number, number] | null>(null);
  const [userLocation, setUserLocation] = useState<LocationCoords | null>(null);
  const [, setUserAddress] = useState<string>('Getting location...');
  const [hasLocationPermission, setHasLocationPermission] = useState(false);
  const [permissionMessage, setPermissionMessage] = useState<string | null>(null);
  const [selectedLayer, setSelectedLayer] = useState<MapLayerKey>('standard');
  const [layerAvailability, setLayerAvailability] = useState<Record<MapLayerKey, boolean>>(
    DEFAULT_LAYER_AVAILABILITY
  );
  const [hasLoadedSelectedLayer, setHasLoadedSelectedLayer] = useState(false);
  const [showTileSelector, setShowTileSelector] = useState(false);
  const routeGeometry = useRouteStore((state) => state.routeGeometry);
  const routeSteps = useRouteStore((state) => state.routeSteps);
  const fetchRoute = useRouteStore((state) => state.fetchRoute);
  const clearRoute = useRouteStore((state) => state.clearRoute);
  const [routeVersion, setRouteVersion] = useState<number>(0);
  const [isFollowingUser, setIsFollowingUser] = useState<boolean>(true);
  const [isMovingBearingEnabled, setIsMovingBearingEnabled] = useState<boolean>(false);
  const [arrivalAlertIncidentId, setArrivalAlertIncidentId] = useState<Incident['id'] | null>(null);
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

  useEffect(() => {
    let isMounted = true;

    (async () => {
      try {
        const storedLayer = await AsyncStorage.getItem(MAP_LAYER_STORAGE_KEY);
        if (!isMounted) return;

        if (storedLayer && isMapLayerKey(storedLayer)) {
          setSelectedLayer(storedLayer);
        }
      } catch (error) {
        console.log('Error restoring selected map layer:', error);
      } finally {
        if (isMounted) {
          setHasLoadedSelectedLayer(true);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    (async () => {
      const probeEntries = await Promise.all(
        Object.entries(TILE_PROBE_URLS).map(async ([layerKey, url]) => [
          layerKey as MapLayerKey,
          await isTileEndpointAvailable(url),
        ])
      );

      if (!isMounted) return;

      setLayerAvailability((previous) => ({
        ...previous,
        ...(Object.fromEntries(probeEntries) as Partial<Record<MapLayerKey, boolean>>),
      }));
    })();

    return () => {
      isMounted = false;
    };
  }, []);

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
    switch (selectedLayer) {
      case 'osm':
        return OPEN_STREET_MAP_STYLE;
      case 'maptilerStreets':
        return MAPTILER_STREETS_STYLE;
      case 'tracestrackDefault':
        return TRACESTRACK_DEFAULT_STYLE;
      case 'tracestrackEnglish':
        return TRACESTRACK_ENGLISH_STYLE;
      case 'tracestrackLocalized':
        return TRACESTRACK_LOCALIZED_STYLE;
      case 'stadiaDark':
        return STADIA_DARK_STYLE;
      case 'terrain':
        return OPEN_TOPO_STYLE;
      case 'satellite':
        return SATELLITE_STYLE;
      case 'standard':
      default:
        return isDarkMode ? CARTO_DB_DARK_STYLE : CARTO_DB_STYLE;
    }
  }, [isDarkMode, selectedLayer]);
  const selectedLayerOption = useMemo(
    () => MAP_LAYER_OPTIONS.find((layer) => layer.key === selectedLayer) ?? MAP_LAYER_OPTIONS[0],
    [selectedLayer]
  );

  useEffect(() => {
    if (!hasLoadedSelectedLayer) {
      return;
    }

    AsyncStorage.setItem(MAP_LAYER_STORAGE_KEY, selectedLayer).catch((error) => {
      console.log('Error saving selected map layer:', error);
    });
  }, [hasLoadedSelectedLayer, selectedLayer]);

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
    normalizedIncident,
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
    if (incidentDistanceMeters !== null && incidentDistanceMeters <= 30) {
      return;
    }

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
  }, [incidentDistanceMeters, userLocation, routeSteps, nextStepIndex]);

  useEffect(() => {
    if (!incident?.id || incidentDistanceMeters === null || incidentDistanceMeters > 30) {
      return;
    }

    if (arrivalAlertIncidentId === incident.id) {
      return;
    }

    Speech.stop();
    Vibration.cancel();
    Vibration.vibrate(ARRIVAL_VIBRATION_PATTERN, false);
    setArrivalAlertIncidentId(incident.id);
  }, [arrivalAlertIncidentId, incident?.id, incidentDistanceMeters]);

  const handleToggleFollow = useCallback(() => {
    setIsFollowingUser((prev) => !prev);
  }, []);

  const handleToggleMovingBearing = useCallback(() => {
    setIsMovingBearingEnabled((prev) => {
      const next = !prev;
      if (next) {
        setIsFollowingUser(true);
      }
      return next;
    });
  }, []);

  const renderMode = 'native';
  const androidRenderMode = undefined;
  const isMovingBearingActive = isMovingBearingEnabled && isFollowingUser && hasLocationPermission;

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

      {permissionMessage && (
        <View style={styles.permissionError}>
          <Text style={styles.permissionErrorText}>{permissionMessage}</Text>
        </View>
      )}

      {isMovingBearingActive && (
        <View pointerEvents="none" style={styles.bearingPointerContainer}>
          <View style={[styles.bearingPointerBadge, isDarkMode && styles.bearingPointerBadgeDark]}>
            <View style={styles.bearingPointerIcon}>
              <Icon name="send" size={18} color="#FFFFFF" />
            </View>
          </View>
        </View>
      )}

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

      <TouchableOpacity
        style={[
          styles.tilePickerButton,
          isDarkMode && styles.tilePickerButtonDark,
        ]}
        activeOpacity={0.9}
        onPress={() => setShowTileSelector(true)}>
        <View style={styles.tilePickerIconWrap}>
          <Icon name="layers" size={18} color="#fff" />
        </View>
        <View style={styles.tilePickerCopy}>
          <Text style={[styles.tilePickerLabel, isDarkMode && styles.tilePickerLabelDark]}>
            Map Tiles
          </Text>
          <Text style={[styles.tilePickerValue, isDarkMode && styles.tilePickerValueDark]}>
            {selectedLayerOption.label}
          </Text>
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

      <MapTileSelectorModal
        visible={showTileSelector}
        selectedLayer={selectedLayer}
        options={MAP_LAYER_OPTIONS}
        isDarkMode={isDarkMode}
        layerAvailability={layerAvailability}
        onClose={() => setShowTileSelector(false)}
        onSelectLayer={setSelectedLayer}
      />
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
});

export default MapScreen;
