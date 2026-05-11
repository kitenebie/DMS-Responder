import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Pressable,
  SafeAreaView,
} from 'react-native';
import { IncidentStatus, ReportStatus, ReportForm } from '@/types';
import {
  STATUS_FLOW,
  STATUS_COLORS,
  fetchReportStatus,
  updateReportStatus,
  getCurrentStatus,
} from '@/mockData';
import { getTheme } from '@/utils';
import { submitReportForm } from './lib/axios';
import { Icon } from './Icon';
import { ReportForm as ReportFormComponent } from './ReportForm';

interface StatusTrackerProps {
  incidentId?: string | null;
  onUpdateStatus: (status: IncidentStatus) => void;
  isDarkMode: boolean;
  currentStatus?: IncidentStatus;
  onOpenReportForm?: () => void;
}

const statusIconNames: Record<string, string> = {
  Pending: 'clock',
  Ongoing: 'bolt',
  Arrived: 'map-pin',
  Completed: 'check',
  Cancelled: 'close',
  Cleared: 'cleared-report',
};

// Helper to format timestamp
const formatTime = (timestamp: string | null): string => {
  if (!timestamp) return 'N/A';
  try {
    // Handle both formats: "2026-02-06 00:11:04" and "2026-02-06T00:02:23.000000Z"
    const date = new Date(timestamp.replace(' ', 'T'));
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return 'N/A';
  }
};

// Get timestamp for a status
const getTimestamp = (status: string, reportStatus: ReportStatus | null): string | null => {
  switch (status) {
    case 'Ongoing':
      return reportStatus?.ongoing_at || null;
    case 'Arrived':
      return reportStatus?.arrived_at || null;
    case 'Completed':
      return reportStatus?.completed_at || null;
    case 'Cleared':
      return reportStatus?.cleared_at || null;
    case 'Cancelled':
      return reportStatus?.declined_at || null;
    default:
      return reportStatus?.created_at || null;
  }
};

export const StatusTracker: React.FC<StatusTrackerProps> = ({
  incidentId,
  onUpdateStatus,
  isDarkMode,
  onOpenReportForm,
}) => {
  const theme = getTheme(isDarkMode);
  const normalizedIncidentId = incidentId ?? undefined;
  const [reportStatus, setReportStatus] = useState<ReportStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<IncidentStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [reportFormVisible, setReportFormVisible] = useState(false);
  const [reportFormData, setReportFormData] = useState<ReportForm>({
    actionsTaken: '',
    timeArrived: '',
    timeCompleted: '',
    additionalNotes: '',
  });
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [submittingForm, setSubmittingForm] = useState(false);

  // Refresh status from API
  const refreshStatus = async () => {
    try {
      const statusData = await fetchReportStatus(normalizedIncidentId);

      // Validate that Incident.id matches ReportStatus.report_id
      if (statusData && incidentId) {
        const incidentIdNum = parseInt(incidentId, 10);
        if (statusData.report_id !== incidentIdNum) {
          console.error(
            `Status mismatch: Incident.id (${incidentId}) does not match ReportStatus.report_id (${statusData.report_id})`
          );
          setStatusError('Status mismatch: Report does not match current incident');
          setReportStatus(null);
          return;
        }
      }

      setStatusError(null);
      setReportStatus(statusData);
    } catch (error) {
      console.error('Error refreshing status:', error);
      setStatusError('Failed to load status');
    }
  };

  // Handle status update
  const handleUpdateStatus = async (status: IncidentStatus) => {
    // If clicking Completed, show report form instead of confirmation
    if (status === 'Completed') {
      console.log('Completed clicked, showing report form modal');
      setReportFormVisible(true);
      return;
    }
    setPendingStatus(status);
    setConfirmModalVisible(true);
  };

  // Confirm and execute status update
  const confirmStatusUpdate = async () => {
    if (!pendingStatus || updating) return;

    setConfirmModalVisible(false);
    setUpdating(true);
    console.log(`Updating status to: ${pendingStatus}`);

    try {
      const success = await updateReportStatus({
        status: pendingStatus,
        reportId: normalizedIncidentId,
      });
      if (success) {
        console.log('Status updated successfully, calling onUpdateStatus with:', pendingStatus);
        // Notify parent component FIRST
        onUpdateStatus(pendingStatus);
        // Refresh status from API
        await refreshStatus();
      }
    } catch (error) {
      console.error('Error updating status:', error);
    } finally {
      setUpdating(false);
      setPendingStatus(null);
    }
  };

  // Cancel status update
  const cancelStatusUpdate = () => {
    setConfirmModalVisible(false);
    setPendingStatus(null);
  };

  // Handle report form changes
  const handleReportFormUpdate = (field: keyof ReportForm, value: string) => {
    setReportFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Submit report form and update status
  const handleReportFormSubmit = async () => {
    if (submittingForm) return;

    setSubmittingForm(true);

    try {
      // Submit the report form to API
      await submitReportForm(reportFormData, photoUri, normalizedIncidentId);
      console.log('Report form submitted, setting pendingStatus to Completed');

      setReportFormVisible(false);
      setPendingStatus('Completed');
      setConfirmModalVisible(true);
    } catch (error) {
      console.error('Error submitting report form:', error);
      Alert.alert('Error', 'Failed to submit report. Please try again.');
    } finally {
      setSubmittingForm(false);
    }
  };

  // Cancel report form
  const cancelReportForm = () => {
    setReportFormVisible(false);
    setReportFormData({
      actionsTaken: '',
      timeArrived: '',
      timeCompleted: '',
      additionalNotes: '',
    });
    setPhotoUri(null);
  };

  const handlePhotoCaptured = (uri: string) => {
    setPhotoUri(uri);
  };

  // Remove photo
  const handleRemovePhoto = () => {
    setPhotoUri(null);
  };

  useEffect(() => {
    let isMounted = true;

    const loadStatus = async () => {
      setLoading(true);
      console.log('Loading status...');

      // Add timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), 10000);
      });

      try {
        const fetchPromise = fetchReportStatus(normalizedIncidentId);
        const statusData = (await Promise.race([
          fetchPromise,
          timeoutPromise,
        ])) as ReportStatus | null;

        if (isMounted) {
          console.log('Status data received:', statusData);

          // Validate that Incident.id matches ReportStatus.report_id
          if (statusData && incidentId) {
            const incidentIdNum = parseInt(incidentId, 10);
            if (statusData.report_id !== incidentIdNum) {
              console.error(
                `Status mismatch: Incident.id (${incidentId}) does not match ReportStatus.report_id (${statusData.report_id})`
              );
              setStatusError('Status mismatch: Report does not match current incident');
              setReportStatus(null);
              setLoading(false);
              return;
            }
          }

          setStatusError(null);
          setReportStatus(statusData);
          setLoading(false);
        }
      } catch (error: any) {
        console.error('Error loading status:', error.message);
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadStatus();

    return () => {
      isMounted = false;
    };
  }, [incidentId, normalizedIncidentId]);

  const currentStatus = getCurrentStatus(reportStatus);
  const currentIndex = STATUS_FLOW.indexOf(currentStatus);

  useEffect(() => {
    if (reportStatus) {
      console.log('Current Status in StatusTracker:', currentStatus);
      onUpdateStatus(currentStatus);
    }
  }, [reportStatus, currentStatus, onUpdateStatus]);

  // Filter statuses to show: from start up to current status + next one
  const getVisibleStatuses = () => {
    if (currentIndex === -1) return STATUS_FLOW;
    // Show all statuses up to current + 1 (next status), but cap at end
    const endIndex = Math.min(currentIndex + 2, STATUS_FLOW.length);
    return STATUS_FLOW.slice(0, endIndex);
  };

  const visibleStatuses = getVisibleStatuses();

  if (loading) {
    return (
      <View
        style={[styles.container, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={styles.header}>
          <Icon name="clock" size={20} color="#FBBF24" />
          <Text style={[styles.title, { color: theme.text }]}>Status Timeline</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#FBBF24" />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
            Loading status...
          </Text>
        </View>
      </View>
    );
  }

  // Show error if status mismatch
  if (statusError) {
    return (
      <View
        style={[styles.container, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={styles.header}>
          <Icon name="clock" size={20} color="#FBBF24" />
          <Text style={[styles.title, { color: theme.text }]}>Status Timeline</Text>
        </View>
        <View style={styles.errorContainer}>
          <Icon name="alert" size={24} color="#EF4444" />
          <Text style={[styles.errorText, { color: '#EF4444' }]}>{statusError}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={styles.header}>
        <Icon name="clock" size={20} color="#FBBF24" />
        <Text style={[styles.title, { color: theme.text }]}>Status Timeline</Text>
      </View>

      <View style={styles.timeline}>
        {/* Timeline Line */}
        <View style={[styles.timelineLine, { backgroundColor: theme.border }]} />

        {visibleStatuses.map((status, index) => {
          const isActive = currentStatus === status;
          const isPassed = STATUS_FLOW.indexOf(status) < currentIndex;
          const actualIndex = STATUS_FLOW.indexOf(status);
          const color = STATUS_COLORS[status];
          const isLeft = actualIndex % 2 === 0;
          const timestamp = getTimestamp(status, reportStatus);

          return (
            <View key={status} style={styles.timelineItem}>
              {isLeft ? (
                <>
                  {/* Left side content */}
                  <TouchableOpacity
                    disabled={isActive || updating || timestamp != null}
                    onPress={() => handleUpdateStatus(status as IncidentStatus)}
                    style={[
                      styles.statusButton,
                      {
                        backgroundColor: isActive ? color + '20' : theme.surfaceAlt,
                        borderColor: isActive ? color : theme.border,
                        alignItems: 'flex-end',
                      },
                    ]}>
                    {isActive && (
                      <View style={styles.pulseIndicator}>
                        <Icon name="check" size={20} color={color} />
                      </View>
                    )}
                    <Text
                      style={[
                        styles.statusText,
                        { color: isActive ? color : theme.text, fontSize: isActive ? 15 : 14 },
                      ]}>
                      {status}
                    </Text>
                    <Text style={[styles.statusSubtext, { color: theme.textSecondary }]}>
                      {isPassed ? 'Completed' : isActive ? 'Current Status' : 'Pending'}
                    </Text>
                    {timestamp && (
                      <Text style={[styles.timestamp, { color: theme.textSecondary }]}>
                        {formatTime(timestamp)}
                      </Text>
                    )}
                  </TouchableOpacity>

                  {/* Timeline node */}
                  <TouchableOpacity
                    disabled={isActive || updating || timestamp != null}
                    onPress={() => handleUpdateStatus(status as IncidentStatus)}
                    style={[
                      styles.timelineNode,
                      {
                        backgroundColor: isActive || isPassed ? color : theme.surfaceAlt,
                        transform: [{ scale: isActive ? 1.25 : 1 }],
                      },
                    ]}>
                    {isActive ? (
                      <Icon name={statusIconNames[status]} size={16} color="#fff" />
                    ) : isPassed ? (
                      <Icon name="check" size={14} color="#fff" />
                    ) : (
                      <Icon name="lock" size={14} color="#fff" />
                    )}
                  </TouchableOpacity>

                  {/* Right side spacer */}
                  <View style={styles.spacer} />
                </>
              ) : (
                <>
                  {/* Left side spacer */}
                  <View style={styles.spacer} />

                  {/* Timeline node */}
                  <TouchableOpacity
                    disabled={isActive || updating || timestamp != null}
                    onPress={() => handleUpdateStatus(status as IncidentStatus)}
                    style={[
                      styles.timelineNode,
                      {
                        backgroundColor: isActive || isPassed ? color : theme.surfaceAlt,
                        transform: [{ scale: isActive ? 1.25 : 1 }],
                      },
                    ]}>
                    {isActive ? (
                      <Icon name={statusIconNames[status]} size={16} color="#fff" />
                    ) : isPassed ? (
                      <Icon name="check" size={14} color="#fff" />
                    ) : (
                      <Icon name="lock" size={14} color="#fff" />
                    )}
                  </TouchableOpacity>

                  {/* Right side content */}
                  <TouchableOpacity
                    disabled={isActive || updating || timestamp != null}
                    onPress={() => handleUpdateStatus(status as IncidentStatus)}
                    style={[
                      styles.statusButton,
                      {
                        backgroundColor: isActive ? color + '20' : theme.surfaceAlt,
                        borderColor: isActive ? color : theme.border,
                        alignItems: 'flex-start',
                      },
                    ]}>
                    {isActive && (
                      <View style={styles.pulseIndicator}>
                        <Icon name="check" size={20} color={color} />
                      </View>
                    )}
                    <Text
                      style={[
                        styles.statusText,
                        { color: isActive ? color : theme.text, fontSize: isActive ? 15 : 14 },
                      ]}>
                      {status}
                    </Text>
                    <Text style={[styles.statusSubtext, { color: theme.textSecondary }]}>
                      {isPassed ? 'Completed' : isActive ? 'Current Status' : 'Pending'}
                    </Text>
                    {timestamp && (
                      <Text style={[styles.timestamp, { color: theme.textSecondary }]}>
                        {formatTime(timestamp)}
                      </Text>
                    )}
                  </TouchableOpacity>
                </>
              )}
            </View>
          );
        })}
      </View>

      {/* Confirmation Modal */}
      <Modal
        transparent
        visible={confirmModalVisible}
        animationType="fade"
        statusBarTranslucent
        onRequestClose={cancelStatusUpdate}>
        <View style={[styles.modalOverlay, { padding: 24 }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={cancelStatusUpdate} />
          <View
            style={[
              styles.modalContent,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Are you sure?</Text>
            <Text style={[styles.modalMessage, { color: theme.textSecondary }]}>
              Do you want to update the status to {pendingStatus}?
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  styles.cancelButton,
                  { backgroundColor: theme.surfaceAlt },
                ]}
                onPress={cancelStatusUpdate}>
                <Text style={[styles.cancelButtonText, { color: theme.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={confirmStatusUpdate}>
                <Text style={styles.confirmButtonText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Report Form Modal */}
      <Modal
        transparent
        visible={reportFormVisible}
        animationType="fade"
        statusBarTranslucent
        onRequestClose={cancelReportForm}>
        <KeyboardAvoidingView
          style={[styles.reportFormOverlay, { backgroundColor: theme.background }]}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 0}>
          <SafeAreaView style={styles.reportFormModalContent}>
            <View
              style={[
                styles.reportFormHeader,
                { backgroundColor: theme.surface, borderBottomColor: theme.border },
              ]}>
              <Text style={[styles.reportFormHeaderTitle, { color: theme.text }]}>Report Form</Text>
              <TouchableOpacity
                onPress={cancelReportForm}
                style={styles.reportFormCloseButton}
                accessibilityRole="button"
                accessibilityLabel="Close report form">
                <Icon name="close" size={20} color={theme.text} />
              </TouchableOpacity>
            </View>

            <View style={[styles.reportFormBody, { backgroundColor: theme.surface }]}>
              <ReportFormComponent
                form={reportFormData}
                onUpdateForm={handleReportFormUpdate}
                onSubmit={handleReportFormSubmit}
                photoUri={photoUri}
                onPhotoCaptured={handlePhotoCaptured}
                onRemovePhoto={handleRemovePhoto}
                submitting={submittingForm}
                isDarkMode={isDarkMode}
                incidentId={incidentId}
              />
            </View>

            <View
              style={[
                styles.reportFormFooter,
                { backgroundColor: theme.surface, borderTopColor: theme.border },
              ]}>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  styles.cancelButton,
                  { backgroundColor: theme.surfaceAlt },
                ]}
                onPress={cancelReportForm}>
                <Text style={[styles.cancelButtonText, { color: theme.text }]}>Close</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
  },
  loadingContainer: {
    paddingVertical: 20,
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    color: '#64748B',
    fontSize: 14,
  },
  errorContainer: {
    paddingVertical: 20,
    alignItems: 'center',
    gap: 8,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 14,
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 24,
  },
  title: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: 'bold',
  },
  timeline: {
    position: 'relative',
  },
  timelineLine: {
    position: 'absolute',
    left: '50%',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: '#E2E8F0',
    transform: [{ translateX: -1 }],
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
  },
  statusButton: {
    width: '42%',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    backgroundColor: '#F8FAFC',
  },
  pulseIndicator: {
    marginBottom: 4,
  },
  statusText: {
    fontWeight: '600',
  },
  statusSubtext: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 2,
  },
  timestamp: {
    color: '#94A3B8',
    fontSize: 10,
    marginTop: 4,
  },
  timelineNode: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
    marginHorizontal: 8,
    backgroundColor: '#E2E8F0',
  },
  nodeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#CBD5E1',
  },
  spacer: {
    width: '42%',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    width: '80%',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  modalTitle: {
    color: '#0F172A',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalMessage: {
    color: '#64748B',
    fontSize: 14,
    marginBottom: 24,
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#F1F5F9',
  },
  confirmButton: {
    backgroundColor: '#3B82F6',
  },
  cancelButtonText: {
    color: '#0F172A',
    fontWeight: '600',
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  reportFormOverlay: {
    flex: 1,
    width: '100%',
  },
  reportFormModalContent: {
    flex: 1,
    width: '100%',
  },
  reportFormHeader: {
    width: '100%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reportFormHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  reportFormCloseButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  reportFormBody: {
    flex: 1,
    width: '100%',
  },
  reportFormFooter: {
    width: '100%',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    borderTopWidth: 1,
  },
});
