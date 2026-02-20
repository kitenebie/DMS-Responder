import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Image, TextInput, ActivityIndicator } from 'react-native';
import { Incident } from '@/types';
import { formatTime } from '@/utils';
import { Icon } from './Icon';
import { acceptIncident, declineIncident } from '@/mockData';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface IncomingModalProps {
  visible: boolean;
  incident: Incident;
  onAccept: () => void;
  onDismiss: () => void;
}

export const IncomingModal: React.FC<IncomingModalProps> = ({
  visible,
  incident,
  onAccept,
  onDismiss,
}) => {
  const [showDeclineOptions, setShowDeclineOptions] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const getStoredUserId = async (): Promise<string> => {
    try {
      const userData = await AsyncStorage.getItem('user');
      if (userData) {
        const parsedUser = JSON.parse(userData);
        return parsedUser.user?.id || '';
      }
      return '';
    } catch (error) {
      console.error('Error getting user data:', error);
      return '';
    }
  };

  const handleAccept = async () => {
    if (isLoading) return;
    setIsLoading(true);
    setError('');

    try {
      const userId = await getStoredUserId();
      if (!userId) {
        setError('Unable to get user ID');
        setIsLoading(false);
        return;
      }

      const success = await acceptIncident(userId, incident.id);
      if (success) {
        setIsLoading(false);
        onAccept();
      } else {
        setError('Failed to accept incident');
        setIsLoading(false);
      }
    } catch (err) {
      setError('Error accepting incident');
      setIsLoading(false);
    }
  };

  const handleDecline = async () => {
    if (!declineReason.trim()) {
      setError('Please enter a decline reason');
      return;
    }

    if (isLoading) return;
    setIsLoading(true);
    setError('');

    try {
      const userId = await getStoredUserId();
      if (!userId) {
        setError('Unable to get user ID');
        setIsLoading(false);
        return;
      }

      const success = await declineIncident(userId, incident.id, declineReason.trim());
      if (success) {
        setIsLoading(false);
        onDismiss();
      } else {
        setError('Failed to decline incident');
        setIsLoading(false);
      }
    } catch (err) {
      setError('Error declining incident');
      setIsLoading(false);
    }
  };

  const handleDismiss = () => {
    if (!isLoading) {
      setShowDeclineOptions(false);
      setDeclineReason('');
      setError('');
      onDismiss();
    }
  };

  return (
    <Modal transparent visible={visible} animationType="fade" statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerIconContainer}>
              <Icon name={incident.icon || 'warning'} size={24} color="#fff" />
            </View>
            <View>
              <Text style={styles.headerTitle}>Incoming Incident Report</Text>
              <Text style={styles.headerSubtitle}>Priority: {incident.priority}</Text>
            </View>
          </View>

          {/* Report Attachment */}
          {incident.report_attachment && (
            <View style={styles.infoCard}>
              <View style={styles.infoCardHeader}>
                <Icon name="image" size={16} color="#60A5FA" />
                <Text style={styles.infoLabel}>Attachment</Text>
              </View>
              <Image
                source={{ uri: incident.report_attachment }}
                style={styles.attachmentImage}
                resizeMode="cover"
              />
            </View>
          )}

          {/* Content */}
          <View style={styles.content}>
            {/* Type and Time Grid */}
            <View style={styles.gridRow}>
              <View style={[styles.infoCard, styles.gridItem]}>
                <View style={styles.infoCardHeader}>
                  <Icon name="bolt" size={16} color="#FBBF24" />
                  <Text style={styles.infoLabel}>Type</Text>
                </View>
                <Text style={styles.infoValueSmall}>{incident.type}</Text>
              </View>

              <View style={[styles.infoCard, styles.gridItem]}>
                <View style={styles.infoCardHeader}>
                  <Icon name="clock" size={16} color="#4ADE80" />
                  <Text style={styles.infoLabel}>Time</Text>
                </View>
                <Text style={styles.infoValueSmall}>{formatTime(incident.timeReported)}</Text>
              </View>
            </View>

            {/* Location */}
            <View style={styles.infoCard}>
              <View style={styles.infoCardHeader}>
                <Icon name="location" size={16} color="#F87171" />
                <Text style={styles.infoLabel}>Location</Text>
              </View>
              <Text style={styles.infoValue}>{incident.location}</Text>
            </View>

            {/* Description */}
            <View style={styles.infoCard}>
              <View style={styles.infoCardHeader}>
                <Icon name="info" size={16} color="#C084FC" />
                <Text style={styles.infoLabel}>Description</Text>
              </View>
              <Text style={styles.descriptionText}>{incident.description}</Text>
            </View>

            {/* Error Message */}
            {error ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* Decline Reason Input */}
            {showDeclineOptions && (
              <View style={styles.declineContainer}>
                <Text style={styles.declineLabel}>Reason for declining:</Text>
                <TextInput
                  style={styles.declineInput}
                  placeholder="Enter decline reason..."
                  placeholderTextColor="#9CA3AF"
                  value={declineReason}
                  onChangeText={setDeclineReason}
                  multiline
                  numberOfLines={3}
                  editable={!isLoading}
                />
              </View>
            )}
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            {showDeclineOptions ? (
              <>
                <TouchableOpacity
                  onPress={() => setShowDeclineOptions(false)}
                  style={styles.cancelButton}
                  disabled={isLoading}>
                  <Text style={styles.cancelButtonText}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleDecline}
                  style={[styles.declineButton, isLoading && styles.buttonDisabled]}
                  disabled={isLoading}>
                  {isLoading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Icon name="close" size={18} color="#fff" />
                      <Text style={styles.declineButtonText}>Confirm Decline</Text>
                    </>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity
                  onPress={handleDismiss}
                  style={styles.dismissButton}
                  disabled={isLoading}>
                  <Text style={styles.dismissButtonText}>Dismiss</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setShowDeclineOptions(true)}
                  style={[styles.declineOptionButton, isLoading && styles.buttonDisabled]}
                  disabled={isLoading}>
                  <Icon name="close" size={18} color="#fff" />
                  <Text style={styles.declineOptionButtonText}>Decline</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleAccept}
                  style={[styles.acceptButton, isLoading && styles.buttonDisabled]}
                  disabled={isLoading}>
                  {isLoading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Icon name="check" size={18} color="#fff" />
                      <Text style={styles.acceptButtonText}>Accept</Text>
                    </>
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modal: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#334155',
    overflow: 'hidden',
  },
  header: {
    backgroundColor: '#DC2626',
    paddingVertical: 16,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    color: '#FECACA',
    fontSize: 13,
    marginTop: 2,
  },
  content: {
    padding: 12,
    gap: 6,
  },
  infoCard: {
    backgroundColor: '#334155',
    borderRadius: 8,
    padding: 12,
    gap: 6,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 4,
  },
  gridItem: {
    flex: 1,
  },
  infoCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoLabel: {
    color: '#9CA3AF',
    fontSize: 12,
  },
  infoValue: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  infoValueSmall: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  descriptionText: {
    color: '#fff',
    fontSize: 13,
    lineHeight: 20,
  },
  attachmentImage: {
    width: '100%',
    height: 200,
    marginTop: 8,
  },
  errorContainer: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 13,
  },
  declineContainer: {
    marginTop: 8,
  },
  declineLabel: {
    color: '#9CA3AF',
    fontSize: 12,
    marginBottom: 8,
  },
  declineInput: {
    backgroundColor: '#334155',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  dismissButton: {
    flex: 1,
    backgroundColor: '#475569',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  dismissButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  declineOptionButton: {
    flex: 1,
    backgroundColor: '#DC2626',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  declineOptionButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  acceptButton: {
    flex: 1,
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  acceptButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#475569',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  declineButton: {
    flex: 1,
    backgroundColor: '#DC2626',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  declineButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
