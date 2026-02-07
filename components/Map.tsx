import React from 'react';
import { View, StyleSheet } from 'react-native';
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
}

export const Map: React.FC<MapProps> = ({
  isDarkMode,
  isFullscreen,
  incident,
  onToggleFullscreen,
  onMapPress,
  onMapRelease,
}) => {

  return (
    <View
      style={[
        styles.mapContainer,
        {
          backgroundColor: isDarkMode ? '#1a1a2e' : '#E0E7FF',
          height: isFullscreen ? '100%' : 560,
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

      {/* Map Screen - Always rendered to prevent re-mount on fullscreen toggle */}
      <View style={[styles.mapScreenWrapper, { opacity: 1 }]}>
        <MapScreen
          onMapPress={onMapPress}
          onMapRelease={onMapRelease}
          isDarkMode={isDarkMode}
          incident={incident}
          isFullscreen={isFullscreen}
          onToggleFullscreen={onToggleFullscreen}
        />
      </View>
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
});
