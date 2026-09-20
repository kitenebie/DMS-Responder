import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Incident } from '../src/types';
import { GOOGLE_MAP_ID, GOOGLE_MAPS_API_KEY } from '../src/config/maps';
import { Icon } from './Icon';
import { locationService, type LocationCoords } from './services/locationService';
import { useRouteStore } from './routeStore';

interface GoogleMapScreenProps {
  onMapPress?: () => void;
  onMapRelease?: () => void;
  isDarkMode: boolean;
  incident?: Incident | null;
  onToggleFullscreen?: () => void;
  isFullscreen: boolean;
  isActive?: boolean;
  showFullscreenToggle?: boolean;
  isFollowingUser?: boolean;
  onFollowingUserChange?: (following: boolean) => void;
  onGoogleMapUnavailable: (reason: string) => void;
}

type MapMessage = {
  type: 'ready' | 'click' | 'long-press' | 'move' | 'streetview-change' | 'map-error';
  message?: string;
  visible?: boolean;
};

const DEFAULT_LOCATION = { latitude: 12.706220102613308, longitude: 124.02982096568188 };

const normalizeCoordinates = (coords?: { lat: number; lng: number } | null) => {
  if (!coords) return null;
  if (Math.abs(coords.lat) <= 90 && Math.abs(coords.lng) <= 180) return coords;
  if (Math.abs(coords.lng) <= 90 && Math.abs(coords.lat) <= 180) {
    return { lat: coords.lng, lng: coords.lat };
  }
  return null;
};

const createGoogleMapHtml = (apiKey: string, mapId: string) => `<!doctype html>
<html><head><meta name="viewport" content="initial-scale=1, maximum-scale=1, user-scalable=no" />
<style>html,body,#map{height:100%;width:100%;margin:0;padding:0;background:#e5e7eb}</style></head>
<body><div id="map"></div><script>
  let map, responderMarker, destinationMarker, routePolyline, streetView;
  const send = (type, extra = {}) => window.ReactNativeWebView?.postMessage(JSON.stringify({ type, ...extra }));
  const asLatLng = (point) => ({ lat: point.latitude, lng: point.longitude });
  window.gm_authFailure = () => send('map-error', { message: 'Google Maps authentication failed.' });
  window.updateResponderMap = (payload) => {
    if (!map || !payload) return;
    if (payload.userLocation) {
      const position = asLatLng(payload.userLocation);
      if (!responderMarker) responderMarker = new google.maps.Marker({ position, map, title: 'Your location', icon: { path: google.maps.SymbolPath.CIRCLE, scale: 8, fillColor: '#2563EB', fillOpacity: 1, strokeColor: '#FFFFFF', strokeWeight: 3 } });
      else responderMarker.setPosition(position);
      if (payload.followUser) map.panTo(position);
    }
    if (payload.destination) {
      const position = { lat: payload.destination.lat, lng: payload.destination.lng };
      if (!destinationMarker) destinationMarker = new google.maps.Marker({ position, map, title: payload.destinationTitle || 'Incident destination' });
      else destinationMarker.setPosition(position);
    } else if (destinationMarker) { destinationMarker.setMap(null); destinationMarker = null; }
    if (Array.isArray(payload.routeCoordinates) && payload.routeCoordinates.length > 1) {
      const path = payload.routeCoordinates.map(([lng, lat]) => ({ lat, lng }));
      if (!routePolyline) routePolyline = new google.maps.Polyline({ map, path, strokeColor: '#2563EB', strokeWeight: 7, strokeOpacity: 0.92 });
      else routePolyline.setPath(path);
    } else if (routePolyline) { routePolyline.setMap(null); routePolyline = null; }
  };
  window.initGoogleMap = () => {
    // The Google renderer intentionally uses the Maps JavaScript API directly.
    map = new google.maps.Map(document.getElementById('map'), {
      center: { lat: ${DEFAULT_LOCATION.latitude}, lng: ${DEFAULT_LOCATION.longitude} }, zoom: 16,
      mapId: '${mapId}',
      mapTypeId: google.maps.MapTypeId.ROADMAP,
      mapTypeControl: true, mapTypeControlOptions: { position: google.maps.ControlPosition.LEFT_TOP, mapTypeIds: ['roadmap', 'satellite', 'hybrid', 'terrain'] },
      zoomControl: true, zoomControlOptions: { position: google.maps.ControlPosition.LEFT_CENTER },
      rotateControl: true, rotateControlOptions: { position: google.maps.ControlPosition.LEFT_CENTER },
      scaleControl: true, streetViewControl: true,
      streetViewControlOptions: { position: google.maps.ControlPosition.LEFT_CENTER },
      fullscreenControl: false, gestureHandling: 'greedy',
    });
    streetView = map.getStreetView();
    streetView.addListener('visible_changed', () => send('streetview-change', { visible: streetView.getVisible() }));
    window.exitStreetView = () => streetView?.setVisible(false);
    map.addListener('click', () => send('click'));
    map.addListener('rightclick', () => send('long-press'));
    map.addListener('dragstart', () => send('move'));
    google.maps.event.addListenerOnce(map, 'tilesloaded', () => send('ready'));
  };
</script><script async defer src="https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&callback=initGoogleMap" onerror="send('map-error',{message:'Google Maps JavaScript API could not load.'})"></script></body></html>`;

const GoogleMapScreen = memo(function GoogleMapScreen({
  onMapPress,
  onMapRelease,
  isDarkMode,
  incident,
  onToggleFullscreen,
  isFullscreen,
  isActive = true,
  showFullscreenToggle = true,
  isFollowingUser: isFollowingUserProp,
  onFollowingUserChange,
  onGoogleMapUnavailable,
}: GoogleMapScreenProps) {
  const webViewRef = useRef<WebView>(null);
  const fallbackSentRef = useRef(false);
  const mapReadyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestedDirectionKeyRef = useRef<string | null>(null);
  const insets = useSafeAreaInsets();
  const [userLocation, setUserLocation] = useState<LocationCoords | null>(null);
  const [hasLocationPermission, setHasLocationPermission] = useState(false);
  const [permissionMessage, setPermissionMessage] = useState<string | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [isFollowingUserLocal, setIsFollowingUserLocal] = useState(true);
  const [isStreetViewVisible, setIsStreetViewVisible] = useState(false);
  const routeGeometry = useRouteStore((state) => state.routeGeometry);
  const routeProfile = useRouteStore((state) => state.routeProfile);
  const setRouteProfile = useRouteStore((state) => state.setRouteProfile);
  const fetchRoute = useRouteStore((state) => state.fetchRoute);
  const isFollowingUser = isFollowingUserProp ?? isFollowingUserLocal;
  const setIsFollowingUser = onFollowingUserChange ?? setIsFollowingUserLocal;

  const destination = useMemo(
    () => normalizeCoordinates(incident?.coordinates),
    [incident?.coordinates]
  );
  const mapHtml = useMemo(() => createGoogleMapHtml(GOOGLE_MAPS_API_KEY, GOOGLE_MAP_ID), []);
  const fullscreenBottomInset = isFullscreen ? Math.max(insets.bottom, 16) : 0;

  const switchToMapLibre = useCallback(
    (reason: string) => {
      if (fallbackSentRef.current) return;
      fallbackSentRef.current = true;
      onGoogleMapUnavailable(reason);
    },
    [onGoogleMapUnavailable]
  );

  useEffect(() => {
    if (!GOOGLE_MAPS_API_KEY)
      switchToMapLibre('Google Maps is not configured. MapLibre is now active.');
  }, [switchToMapLibre]);

  useEffect(() => {
    let mounted = true;
    let subscription: Location.LocationSubscription | null = null;
    const start = async () => {
      const granted = await locationService.requestPermission();
      if (!mounted) return;
      setHasLocationPermission(granted);
      setPermissionMessage(
        granted ? null : 'Location permission is required to show your position.'
      );
      const location = granted
        ? await locationService.getCurrentLocation(true)
        : locationService.getDefaultLocation();
      if (!mounted) return;
      setUserLocation(location);
      if (granted && isActive) {
        subscription = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Balanced, timeInterval: 2000, distanceInterval: 3 },
          ({ coords }) => {
            if (mounted && Number.isFinite(coords.latitude) && Number.isFinite(coords.longitude))
              setUserLocation({ latitude: coords.latitude, longitude: coords.longitude });
          }
        );
      }
    };
    void start().catch(() => mounted && setUserLocation(DEFAULT_LOCATION));
    return () => {
      mounted = false;
      subscription?.remove();
    };
  }, [isActive]);

  useEffect(() => {
    if (!isActive || isMapReady) return;
    mapReadyTimerRef.current = setTimeout(
      () => switchToMapLibre('Google Maps did not finish loading. MapLibre is now active.'),
      20_000
    );
    return () => {
      if (mapReadyTimerRef.current) clearTimeout(mapReadyTimerRef.current);
    };
  }, [isActive, isMapReady, switchToMapLibre]);

  useEffect(() => {
    if (!userLocation || !destination || !incident?.id) return;
    const directionKey = `${incident.id}:${destination.lat.toFixed(5)},${destination.lng.toFixed(5)}:${routeProfile}`;
    if (requestedDirectionKeyRef.current === directionKey) return;
    requestedDirectionKeyRef.current = directionKey;
    void fetchRoute({
      userLat: userLocation.latitude,
      userLng: userLocation.longitude,
      destLat: destination.lat,
      destLng: destination.lng,
    });
  }, [destination, fetchRoute, incident?.id, routeProfile, userLocation]);

  useEffect(() => {
    if (!isMapReady || !userLocation) return;
    const payload = {
      userLocation,
      destination,
      destinationTitle: incident?.location ?? incident?.type ?? 'Incident destination',
      followUser: isFollowingUser,
      routeCoordinates: routeGeometry?.coordinates ?? [],
    };
    webViewRef.current?.injectJavaScript(
      `window.updateResponderMap(${JSON.stringify(payload)}); true;`
    );
  }, [
    destination,
    incident?.id,
    incident?.location,
    incident?.type,
    isFollowingUser,
    isMapReady,
    routeGeometry,
    userLocation,
  ]);

  const onMessage = useCallback(
    (event: { nativeEvent: { data: string } }) => {
      try {
        const message = JSON.parse(event.nativeEvent.data) as MapMessage;
        if (message.type === 'ready') setIsMapReady(true);
        else if (message.type === 'click') onMapPress?.();
        else if (message.type === 'long-press') onMapRelease?.();
        else if (message.type === 'move') setIsFollowingUser(false);
        else if (message.type === 'streetview-change')
          setIsStreetViewVisible(message.visible === true);
        else if (message.type === 'map-error')
          switchToMapLibre(
            message.message ?? 'Google Maps failed to load. MapLibre is now active.'
          );
      } catch {
        /* Ignore messages from pages outside the controlled map document. */
      }
    },
    [onMapPress, onMapRelease, switchToMapLibre]
  );

  return (
    <>
      <WebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={{ html: mapHtml, baseUrl: 'https://localhost' }}
        javaScriptEnabled
        domStorageEnabled
        onMessage={onMessage}
        onError={() => switchToMapLibre('Google Maps page failed to load. MapLibre is now active.')}
        renderLoading={() => (
          <ActivityIndicator style={styles.loading} size="large" color="#2563EB" />
        )}
        startInLoadingState
        style={StyleSheet.absoluteFill}
      />
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        {permissionMessage && (
          <View style={styles.permissionError}>
            <Text style={styles.permissionErrorText}>{permissionMessage}</Text>
          </View>
        )}
        <View style={[styles.bottomActionRow, { bottom: 30 + fullscreenBottomInset }]}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Center map on my location"
            style={[styles.recenterButton, isDarkMode && styles.controlDark]}
            onPress={() => setIsFollowingUser(true)}>
            <Icon
              name="my-location"
              size={20}
              color={isFollowingUser ? '#2563EB' : isDarkMode ? '#fff' : '#0F172A'}
            />
          </TouchableOpacity>
          {isStreetViewVisible && (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Exit Street View"
              style={styles.exitStreetViewButton}
              onPress={() =>
                webViewRef.current?.injectJavaScript('window.exitStreetView?.(); true;')
              }>
              <Icon name="close" size={20} color="#fff" />
            </TouchableOpacity>
          )}
          {incident?.id && destination && (
            <View style={styles.routeProfileButtons}>
              <TouchableOpacity
                style={[
                  styles.routeProfileButton,
                  isDarkMode && styles.controlDark,
                  routeProfile === 'driving' && styles.routeProfileButtonActive,
                ]}
                onPress={() => setRouteProfile('driving')}>
                <Icon
                  name="car"
                  size={18}
                  color={routeProfile === 'driving' ? '#fff' : isDarkMode ? '#fff' : '#0F172A'}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.routeProfileButton,
                  isDarkMode && styles.controlDark,
                  routeProfile === 'foot' && styles.routeProfileButtonActive,
                ]}
                onPress={() => setRouteProfile('foot')}>
                <Icon
                  name="walk"
                  size={18}
                  color={routeProfile === 'foot' ? '#fff' : isDarkMode ? '#fff' : '#0F172A'}
                />
              </TouchableOpacity>
            </View>
          )}
        </View>
        {onToggleFullscreen && showFullscreenToggle && (
          <TouchableOpacity
            style={[
              styles.fullscreenButton,
              isDarkMode && styles.controlDark,
              { bottom: 96 + fullscreenBottomInset },
            ]}
            onPress={onToggleFullscreen}>
            <Icon
              name={isFullscreen ? 'fullscreen-exit' : 'fullscreen'}
              size={20}
              color={isDarkMode ? '#fff' : '#0F172A'}
            />
          </TouchableOpacity>
        )}
      </View>
    </>
  );
});

const styles = StyleSheet.create({
  loading: { ...StyleSheet.absoluteFillObject },
  permissionError: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    backgroundColor: '#B91C1C',
    padding: 10,
    borderRadius: 10,
  },
  permissionErrorText: { color: '#fff', fontWeight: '700', textAlign: 'center' },
  bottomActionRow: {
    position: 'absolute',
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  exitStreetViewButton: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DC2626',
    borderRadius: 12,
    elevation: 6,
  },
  recenterButton: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.96)',
    elevation: 4,
  },
  controlDark: { backgroundColor: 'rgba(15,23,42,0.96)' },
  routeProfileButtons: { flexDirection: 'row', gap: 8 },
  routeProfileButton: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.96)',
    elevation: 4,
  },
  routeProfileButtonActive: { backgroundColor: '#2563EB' },
  fullscreenButton: {
    position: 'absolute',
    left: 16,
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.96)',
    elevation: 4,
  },
});

export default GoogleMapScreen;
