import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  StyleProp,
  ViewStyle,
  NativeModules,
  Platform,
  UIManager,
} from 'react-native';
import { Incident as IncidentType } from '@/types';
import MapScreen from './MapScreen';

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
}) => {
  const resolvedMapHeight = mapHeight ?? (isFullscreen ? Dimensions.get('window').height : 600);
  const canRenderNativeMap = isMapLibreAvailable();

  return (
    <View
      style={[
        styles.mapContainer,
        containerStyle,
        {
          backgroundColor: isDarkMode ? '#1a1a2e' : '#E0E7FF',
          height: resolvedMapHeight,
          borderRadius: isFullscreen ? 0 : 12,
        },
      ]}
    >
      {/* Map Grid Overlay */}
      <View style={styles.mapGrid} />

      {/* SVG Roads Layer */}
      <View style={styles.mapRoads}>
        <View style={StyleSheet.absoluteFillObject}>
          <View className="w-full h-full">
            <View className="flex-1 items-center justify-center">
              {/* Main roads */}
              
            </View>
          </View>
        </View>
      </View>

      {canRenderNativeMap ? (
        <View style={[styles.mapScreenWrapper, { opacity: 1 }]}>
          <MapScreen
            onMapPress={onMapPress}
            onMapRelease={onMapRelease}
            isDarkMode={isDarkMode}
            incident={incident}
            isFullscreen={isFullscreen}
            onToggleFullscreen={onToggleFullscreen}
            showFullscreenToggle={showFullscreenToggle}
          />
        </View>
      ) : (
        <View
          style={[
            styles.mapFallback,
            {
              backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.88)' : 'rgba(255, 255, 255, 0.94)',
              borderColor: isDarkMode ? '#1E3A8A' : '#BFDBFE',
            },
          ]}>
          <Text style={[styles.mapFallbackTitle, { color: isDarkMode ? '#F8FAFC' : '#0F172A' }]}>
            Map unavailable in this build
          </Text>
          <Text
            style={[
              styles.mapFallbackBody,
              { color: isDarkMode ? '#CBD5E1' : '#334155' },
            ]}>
            Rebuild and reinstall the responder development app so the MapLibre native view is
            registered before loading this project.
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
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
});
