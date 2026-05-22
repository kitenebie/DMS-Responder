import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, StatusBar } from 'react-native';
import { Map } from './Map';
import { Icon } from './Icon';
import { Incident, IncidentStatus } from '../src/types';

interface FullscreenMapScreenProps {
  isDarkMode: boolean;
  theme: { background: string; surface: string; text: string; textSecondary: string; surfaceAlt: string };
  headerComponent: React.ReactNode;
  incident: Incident | null;
  onToggleFullscreen: () => void;
  isStatusCompleted: boolean;
  isActive?: boolean;
  nextStatusButton: { label: string; status: IncidentStatus; color: string; icon: string } | null;
  onNextStatus: () => void;
  onOpenChat: () => void;
  markerKey?: string | null;
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
}) => {
  const [isMovingBearingEnabled, setIsMovingBearingEnabled] = useState(false);

  return (
    <View style={[styles.fullscreenContainer, { backgroundColor: theme.background }]}>
      <StatusBar />
      {headerComponent}
      <Map
        isDarkMode={isDarkMode}
        isFullscreen={true}
        incident={incident}
        onToggleFullscreen={onToggleFullscreen}
        onRestoreSize={onToggleFullscreen}
        showFullscreenToggle={!isStatusCompleted}
        isActive={isActive}
        isMovingBearingEnabled={isMovingBearingEnabled}
        onMovingBearingChange={setIsMovingBearingEnabled}
        markerKey={markerKey}
      />

      {/* Action Buttons - Show in fullscreen map */}
      {incident && nextStatusButton && (
        <View style={styles.fullscreenActionButtons} key={`fullscreen-buttons-${nextStatusButton.label}`}>
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
