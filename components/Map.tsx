import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  StyleProp,
  ViewStyle,
  NativeModules,
  Platform,
  TouchableOpacity,
  UIManager,
} from 'react-native';
import { Incident as IncidentType } from '@/types';
import MapScreen from './MapScreen';
import GoogleMapScreen from './GoogleMapScreen';

export type MapProvider = 'google' | 'maplibre';

interface MapProps {
  isDarkMode: boolean;
  isFullscreen: boolean;
  incident: IncidentType | null;
  onToggleFullscreen: () => void;
  onRestoreSize: () => void;
  onMapPress?: () => void;
  onMapRelease?: () => void;
  showFullscreenToggle?: boolean;
  mapHeight?: number;
  containerStyle?: StyleProp<ViewStyle>;
  isMovingBearingEnabled?: boolean;
  onMovingBearingChange?: (enabled: boolean) => void;
  isFollowingUser?: boolean;
  onFollowingUserChange?: (following: boolean) => void;
  isActive?: boolean;
  markerKey?: string | null;
  mapProvider?: MapProvider;
  onMapProviderChange?: (provider: MapProvider) => void;
}

const MAPLIBRE_NATIVE_MODULE_NAME = 'MLRNModule';
const MAPLIBRE_VIEW_MANAGER_NAME = 'MLRNMapView';
const MAPLIBRE_ANDROID_TEXTURE_VIEW_MANAGER_NAME = 'MLRNAndroidTextureMapView';

const hasViewManager = (name: string) => {
  try {
    if (typeof UIManager.getViewManagerConfig !== 'function') {
      return true;
    }

    return Boolean(UIManager.getViewManagerConfig(name));
  } catch {
    return false;
  }
};

const isMapLibreAvailable = () => {
  const nativeModules = NativeModules as Record<string, unknown>;
  if (!nativeModules[MAPLIBRE_NATIVE_MODULE_NAME]) {
    return false;
  }

  if (Platform.OS !== 'android') {
    return hasViewManager(MAPLIBRE_VIEW_MANAGER_NAME);
  }

  return (
    hasViewManager(MAPLIBRE_ANDROID_TEXTURE_VIEW_MANAGER_NAME) ||
    hasViewManager(MAPLIBRE_VIEW_MANAGER_NAME)
  );
};

// Google is rendered by the Maps JavaScript API inside react-native-webview,
// so it does not rely on a separately registered native map view manager.
const isGoogleMapsAvailable = () => Platform.OS !== 'web';

export const Map: React.FC<MapProps> = ({
  isDarkMode,
  isFullscreen,
  incident,
  onToggleFullscreen,
  onMapPress,
  onMapRelease,
  showFullscreenToggle,
  mapHeight,
  containerStyle,
  isMovingBearingEnabled: isMovingBearingEnabledProp,
  onMovingBearingChange,
  isFollowingUser,
  onFollowingUserChange,
  isActive = true,
  markerKey,
  mapProvider: mapProviderProp,
  onMapProviderChange,
}) => {
  const [isMovingBearingEnabledLocal, setIsMovingBearingEnabledLocal] = useState(false);
  const [mapProviderLocal, setMapProviderLocal] = useState<MapProvider>('google');
  const [fallbackMessage, setFallbackMessage] = useState<string | null>(null);
  const isMovingBearingEnabled = isMovingBearingEnabledProp ?? isMovingBearingEnabledLocal;
  const setIsMovingBearingEnabled = onMovingBearingChange ?? setIsMovingBearingEnabledLocal;
  const mapProvider = mapProviderProp ?? mapProviderLocal;

  const setMapProvider = (provider: MapProvider) => {
    setMapProviderLocal(provider);
    onMapProviderChange?.(provider);
  };

  const resolvedMapHeight = mapHeight ?? (isFullscreen ? Dimensions.get('window').height : 600);
  const canRenderNativeMap = isMapLibreAvailable();
  const canRenderGoogleMap = isGoogleMapsAvailable();
  const activeProvider = mapProvider === 'google' && canRenderGoogleMap ? 'google' : 'maplibre';

  const selectProvider = (provider: MapProvider) => {
    setMapProvider(provider);
    setFallbackMessage(null);
  };

  return (
    <View style={[styles.mapLayout, containerStyle]}>
      {!isFullscreen && (
        <View style={styles.providerSwitcher}>
          <Text style={[styles.providerLabel, isDarkMode && styles.providerLabelDark]}>
            Map engine
          </Text>
          <View style={[styles.providerButtons, isDarkMode && styles.providerButtonsDark]}>
            <TouchableOpacity
              accessibilityRole="button"
              disabled={!canRenderGoogleMap}
              onPress={() => canRenderGoogleMap && selectProvider('google')}
              style={[
                styles.providerButton,
                activeProvider === 'google' && styles.providerButtonActive,
                !canRenderGoogleMap && styles.providerButtonDisabled,
              ]}>
              <Text
                style={[
                  styles.providerButtonText,
                  activeProvider === 'google' && styles.providerButtonTextActive,
                ]}>
                Google
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              disabled={!canRenderNativeMap}
              onPress={() => canRenderNativeMap && selectProvider('maplibre')}
              style={[
                styles.providerButton,
                activeProvider === 'maplibre' && styles.providerButtonActive,
                !canRenderNativeMap && styles.providerButtonDisabled,
              ]}>
              <Text
                style={[
                  styles.providerButtonText,
                  activeProvider === 'maplibre' && styles.providerButtonTextActive,
                ]}>
                MapLibre
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      <View
        style={[
          styles.mapContainer,
          {
            backgroundColor: isDarkMode ? '#1a1a2e' : '#E0E7FF',
            height: resolvedMapHeight,
            borderRadius: isFullscreen ? 0 : 12,
          },
        ]}>
        {/* Map Height Label */}
        {!isFullscreen && (
          <View style={styles.heightLabel} pointerEvents="none">
            <Text style={[styles.heightLabelText, isDarkMode && styles.heightLabelTextDark]}>
              {resolvedMapHeight}px
            </Text>
          </View>
        )}

        {/* Map Grid Overlay */}
        <View style={styles.mapGrid} />

        {/* SVG Roads Layer */}
        <View style={styles.mapRoads}>
          <View style={StyleSheet.absoluteFillObject}>
            <View className="h-full w-full">
              <View className="flex-1 items-center justify-center">{/* Main roads */}</View>
            </View>
          </View>
        </View>

        {activeProvider === 'google' ? (
          <View style={[styles.mapScreenWrapper, { opacity: 1 }]}>
            <GoogleMapScreen
              onMapPress={onMapPress}
              onMapRelease={onMapRelease}
              isDarkMode={isDarkMode}
              incident={incident}
              isFullscreen={isFullscreen}
              onToggleFullscreen={onToggleFullscreen}
              showFullscreenToggle={showFullscreenToggle}
              isActive={isActive}
              isFollowingUser={isFollowingUser}
              onFollowingUserChange={onFollowingUserChange}
              onGoogleMapUnavailable={(reason) => {
                setMapProvider('maplibre');
                setFallbackMessage(reason);
              }}
            />
          </View>
        ) : canRenderNativeMap ? (
          <View style={[styles.mapScreenWrapper, { opacity: 1 }]}>
            <MapScreen
              onMapPress={onMapPress}
              onMapRelease={onMapRelease}
              isDarkMode={isDarkMode}
              incident={incident}
              isFullscreen={isFullscreen}
              onToggleFullscreen={onToggleFullscreen}
              showFullscreenToggle={showFullscreenToggle}
              isMovingBearingEnabled={isMovingBearingEnabled}
              onMovingBearingChange={setIsMovingBearingEnabled}
              isFollowingUser={isFollowingUser}
              onFollowingUserChange={onFollowingUserChange}
              isActive={isActive}
              markerKey={markerKey}
            />
          </View>
        ) : (
          <View
            style={[
              styles.mapFallback,
              {
                backgroundColor: isDarkMode
                  ? 'rgba(15, 23, 42, 0.88)'
                  : 'rgba(255, 255, 255, 0.94)',
                borderColor: isDarkMode ? '#1E3A8A' : '#BFDBFE',
              },
            ]}>
            <Text style={[styles.mapFallbackTitle, { color: isDarkMode ? '#F8FAFC' : '#0F172A' }]}>
              Map unavailable in this build
            </Text>
            <Text style={[styles.mapFallbackBody, { color: isDarkMode ? '#CBD5E1' : '#334155' }]}>
              Rebuild and reinstall the responder development app so the MapLibre native view is
              registered before loading this project.
            </Text>
          </View>
        )}

        {fallbackMessage && (
          <View style={styles.fallbackNotice} pointerEvents="none">
            <Text style={styles.fallbackNoticeText}>{fallbackMessage}</Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  mapLayout: {
    width: '100%',
  },
  mapContainer: {
    width: '100%',
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 12,
  },
  mapGrid: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'transparent',
  },
  mapRoads: {
    position: 'absolute',
    inset: 0,
  },
  roadHorizontal: {
    position: 'absolute',
    width: '100%',
    height: 8,
    top: '50%',
    transform: [{ translateY: -4 }],
  },
  roadVertical: {
    position: 'absolute',
    width: 8,
    height: '100%',
    left: '50%',
    transform: [{ translateX: -4 }],
  },
  roadDiagonal1: {
    position: 'absolute',
    width: 4,
    height: '150%',
    top: '-25%',
    left: '50%',
    transform: [{ rotate: '45deg' }, { translateX: -2 }],
  },
  roadDiagonal2: {
    position: 'absolute',
    width: 4,
    height: '150%',
    top: '-25%',
    left: '50%',
    transform: [{ rotate: '-45deg' }, { translateX: -2 }],
  },
  incidentMarkerContainer: {
    position: 'absolute',
    top: '55%',
    left: '48%',
    alignItems: 'center',
  },
  markerPulse: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    transform: [{ translateX: -30 }, { translateY: -30 }],
  },
  markerIcon: {
    zIndex: 10,
  },
  locationLabel: {
    position: 'absolute',
    bottom: -40,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  locationText: {
    fontSize: 12,
    fontWeight: '500',
  },
  noIncidentContainer: {
    position: 'absolute',
    inset: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noIncidentText: {
    fontSize: 16,
  },
  mapControls: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    flexDirection: 'column',
    gap: 8,
  },
  mapControlButton: {
    width: 45,
    height: 45,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapScreenWrapper: {
    position: 'absolute',
    inset: 0,
  },
  providerSwitcher: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  providerLabel: {
    color: '#334155',
    fontSize: 10,
    fontWeight: '800',
    marginBottom: 0,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  providerLabelDark: {
    color: '#CBD5E1',
  },
  providerButtons: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: 10,
    padding: 3,
    elevation: 4,
  },
  providerButtonsDark: {
    backgroundColor: 'rgba(15,23,42,0.96)',
  },
  providerButton: {
    overflow: 'hidden',
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 7,
  },
  providerButtonActive: {
    backgroundColor: '#2563EB',
  },
  providerButtonText: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '800',
  },
  providerButtonTextActive: {
    color: '#fff',
  },
  providerButtonDisabled: {
    opacity: 0.45,
  },
  fallbackNotice: {
    position: 'absolute',
    left: 12,
    right: 12,
    top: 12,
    zIndex: 31,
    backgroundColor: 'rgba(146, 64, 14, 0.94)',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
  },
  fallbackNoticeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  mapFallback: {
    position: 'absolute',
    inset: 16,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    gap: 10,
  },
  mapFallbackTitle: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  mapFallbackBody: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  heightLabel: {
    position: 'absolute',
    top: 8,
    left: 12,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    zIndex: 10,
  },
  heightLabelText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
  },
  heightLabelTextDark: {
    color: '#cbd5e1',
  },
});
