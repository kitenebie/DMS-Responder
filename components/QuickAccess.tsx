import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Modal } from 'react-native';
import { Icon } from './Icon';
import { StatusTracker } from './StatusTracker';
import { IncidentStatus } from '@/types';
import { getTheme } from '@/utils';

interface QuickAccessProps {
  onOpenChat: () => void;
  onOpenHistory: () => void;
  currentStatus: IncidentStatus;
  isDarkMode: boolean;
  onUpdateStatus: (newStatus: IncidentStatus) => void;
}

export const QuickAccess: React.FC<QuickAccessProps> = ({
  onOpenChat,
  onOpenHistory,
  currentStatus,
  isDarkMode,
  onUpdateStatus,
}) => {
  const [showStatusModal, setShowStatusModal] = useState(false);
  const theme = getTheme(isDarkMode);

  const handleOpenStatus = () => {
    setShowStatusModal(true);
  };

  const handleCloseStatus = () => {
    setShowStatusModal(false);
  };

  const handleStatusUpdate = (newStatus: IncidentStatus) => {
    onUpdateStatus(newStatus);
    setShowStatusModal(false);
  };

  return (
    <>
      <View style={[styles.container, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        {/* Status Quick Access */}
        <Pressable
          onPress={handleOpenStatus}
          style={styles.quickButton}
        >
          <View style={styles.iconContainer}>
            <Icon name="clock" size={20} color="#fff" />
          </View>
          <View style={styles.buttonContent}>
            <Text style={[styles.buttonLabel, { color: theme.text }]}>Status</Text>
            <Text style={[styles.buttonValue, { color: theme.textSecondary }]}>{currentStatus}</Text>
          </View>
          <Icon name="chevron-right" size={16} color={theme.textSecondary} style={styles.chevron} />
        </Pressable>

        <View style={[styles.divider, { backgroundColor: theme.border }]} />

        {/* Chat Quick Access */}
        <Pressable
          onPress={onOpenChat}
          style={styles.quickButton}
        >
          <View style={styles.iconContainer}>
            <Icon name="chat" size={20} color="#fff" />
          </View>
          <View style={styles.buttonContent}>
            <Text style={[styles.buttonLabel, { color: theme.text }]}>Dispatch Chat</Text>
            <Text style={[styles.buttonSubtext, { color: theme.textSecondary }]}>Tap to message</Text>
          </View>
          <Icon name="chevron-right" size={16} color={theme.textSecondary} style={styles.chevron} />
        </Pressable>
      </View>

      {/* Full Screen Status Modal */}
      <Modal
        visible={showStatusModal}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={handleCloseStatus}
      >
        <View style={[styles.modalContainer, { backgroundColor: theme.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
            <Pressable onPress={handleCloseStatus} style={styles.closeButton}>
              <Icon name="close" size={24} color={theme.text} />
            </Pressable>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Update Status</Text>
            <View style={styles.placeholder} />
          </View>
          <View style={styles.modalContent}>
            <StatusTracker
              currentStatus={currentStatus}
              onUpdateStatus={handleStatusUpdate}
              isDarkMode={isDarkMode}
            />
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    overflow: 'hidden',
  },
  containerDark: {
    // Dark mode is default
  },
  quickButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonContent: {
    flex: 1,
    marginLeft: 12,
  },
  buttonLabel: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '600',
  },
  buttonValue: {
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 2,
  },
  buttonSubtext: {
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: '#334155',
    marginHorizontal: 14,
  },
  chevron: {
    marginLeft: 8,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  modalContainerDark: {
    backgroundColor: '#0F172A',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '600',
  },
  placeholder: {
    width: 44,
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
});
