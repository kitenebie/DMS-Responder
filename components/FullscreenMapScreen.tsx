import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  StatusBar,
  type LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Map, type MapProvider } from './Map';
import { Icon } from './Icon';
import { Incident, IncidentStatus } from '../src/types';

const FULLSCREEN_ACTION_BAR_HEIGHT = 60;

interface FullscreenMapScreenProps {
  isDarkMode: boolean;
  theme: {
    background: string;
    surface: string;
    text: string;
    textSecondary: string;
    surfaceAlt: string;
  };
  headerComponent: React.ReactNode;
  incident: Incident | null;
  onToggleFullscreen: () => void;
  isStatusCompleted: boolean;
  isActive?: boolean;
  nextStatusButton: { label: string; status: IncidentStatus; color: string; icon: string } | null;
  onNextStatus: () => void;
  onOpenChat: () => void;
  markerKey?: string | null;
  mapProvider: MapProvider;
  onMapProviderChange: (provider: MapProvider) => void;
  isMovingBearingEnabled: boolean;
  onMovingBearingChange: (enabled: boolean) => void;
  isFollowingUser: boolean;
  onFollowingUserChange: (following: boolean) => void;
}

export const FullscreenMapScreen: React.FC<FullscreenMapScreenProps> = ({
  isDarkMode,
  theme,
  headerComponent,
  incident,
  onToggleFullscreen,
  isStatusCompleted,
  isActive = true,
  nextStatusButton,
  onNextStatus,
  onOpenChat,
  markerKey,
  mapProvider,
  onMapProviderChange,
  isMovingBearingEnabled,
  onMovingBearingChange,
  isFollowingUser,
  onFollowingUserChange,
}) => {
  const insets = useSafeAreaInsets();
  const [mapHeight, setMapHeight] = useState(0);
  const actionBarBottom = Math.max(insets.bottom, 16) + 16;
  const mapBottomOffset =
    (incident && nextStatusButton ? FULLSCREEN_ACTION_BAR_HEIGHT + 12 : 0) + actionBarBottom;

  const handleMapAreaLayout = (event: LayoutChangeEvent) => {
    const nextHeight = Math.floor(event.nativeEvent.layout.height);
    setMapHeight((currentHeight) => (currentHeight === nextHeight ? currentHeight : nextHeight));
  };

  return (
    <View style={[styles.fullscreenContainer, { backgroundColor: theme.background }]}>
      <StatusBar />
      <View style={styles.headerSlot}>{headerComponent}</View>
      <View
        style={[styles.mapSlot, { marginBottom: mapBottomOffset }]}
        onLayout={handleMapAreaLayout}>
        {mapHeight > 0 && (
          <Map
            isDarkMode={isDarkMode}
            isFullscreen={true}
            incident={incident}
            onToggleFullscreen={onToggleFullscreen}
            onRestoreSize={onToggleFullscreen}
            showFullscreenToggle={!isStatusCompleted}
            isActive={isActive}
            isMovingBearingEnabled={isMovingBearingEnabled}
            onMovingBearingChange={onMovingBearingChange}
            isFollowingUser={isFollowingUser}
            onFollowingUserChange={onFollowingUserChange}
            markerKey={markerKey}
            mapHeight={mapHeight}
            mapProvider={mapProvider}
            onMapProviderChange={onMapProviderChange}
          />
        )}
      </View>

      {/* Action Buttons - Show in fullscreen map */}
      {incident && nextStatusButton && (
        <View
          style={[styles.fullscreenActionButtons, { bottom: actionBarBottom }]}
          key={`fullscreen-buttons-${nextStatusButton.label}`}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: nextStatusButton.color }]}
            onPress={onNextStatus}>
            <Icon name={nextStatusButton.icon as any} size={20} color="#fff" />
            <Text style={styles.actionButtonText}>{nextStatusButton.label}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: '#10B981' }]}
            onPress={onOpenChat}>
            <Icon name="chat" size={20} color="#fff" />
            <Text style={styles.actionButtonText}>Chats</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  fullscreenContainer: {
    flex: 1,
    position: 'relative',
  },
  headerSlot: {
    flexShrink: 0,
  },
  mapSlot: {
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  },
  fullscreenActionButtons: {
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
});
