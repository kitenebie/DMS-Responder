import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, Pressable, StatusBar, ScrollView, StyleSheet, ActivityIndicator, Modal, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ThemeProvider } from './components/ThemeContext';
import { LoginForm } from './components/LoginForm';
import { Map } from './components/Map';
import { IncomingModal } from './components/IncomingModal';
import { IncidentDetails } from './components/IncidentDetails';
import { StatusTracker } from './components/StatusTracker';
import { ChatModal } from './components/ChatModal';
import { HistoryModal } from './components/HistoryModal';
import { ReportForm } from './components/ReportForm';
import { ActionBar } from './components/ActionBar';
import { QuickAccess } from './components/QuickAccess';
import { Icon } from './components/Icon';
import { getCredentials, login } from './components/lib/auth';
import {
  fetchIncomingIncident,
  fetchChatMessages,
  addChatMessage,
  DEFAULT_CONFIG,
  STATUS_COLORS,
} from './src/mockData';
import { submitReportForm } from './components/lib/axios';
import { AppState, ReportForm as ReportFormType, IncidentStatus, Incident } from './src/types';
import { SafeAreaView } from 'react-native-safe-area-context';
import Background from 'Background';

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isAutoLoggingIn, setIsAutoLoggingIn] = useState(true);

  const [state, setState] = useState<AppState>({
    showIncomingModal: false,
    activeIncident: null,
    currentStatus: 'Ongoing',
    isMapFullscreen: false,
    showChat: false,
    showHistory: false,
    isDarkMode: isDarkMode,
    chatMessages: [],
    newMessage: '',
    historySearch: '',
    historyFilter: { type: 'all', status: 'all' },
    reportForm: {
      actionsTaken: '',
      timeArrived: '',
      timeCompleted: '',
      additionalNotes: '',
    },
  });

  const [incomingIncident, setIncomingIncident] = useState<Incident | null>(null);
  const [isMapInteracting, setIsMapInteracting] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  // Auto-login on app start
  useEffect(() => {
    const attemptAutoLogin = async () => {
      try {
        const credentials = await getCredentials();
        if (credentials && credentials.email && credentials.password) {
          console.log('Auto-login with stored credentials');
          await login(credentials.email, credentials.password);
          setIsLoggedIn(true);
        }
      } catch (error) {
        console.log('Auto-login failed:', error);
        // Credentials will remain in storage for manual login attempt
      } finally {
        setIsAutoLoggingIn(false);
      }
    };

    attemptAutoLogin();
  }, []);

  // Fetch incoming incident every 3 seconds
  useEffect(() => {
    const loadIncident = async () => {
      const incident = await fetchIncomingIncident();
      
      // Check if the incident is a valid real incident (not "Unknown" defaults)
      const isValidIncident = JSON.stringify(incident);
      
      // If incident is already accepted, automatically set it as active and show on map
      if (isValidIncident && incident.isAccepted) {
        setIncomingIncident(incident);
        setState((prev) => ({
          ...prev,
          activeIncident: incident,
          currentStatus:
            (incident.status as IncidentStatus) || ('Ongoing' as IncidentStatus),
        }));
        return;
      }
      
      setIncomingIncident(incident);
      console.log(`is VALID: ${isValidIncident}`)
      // Show the modal when a valid incident is fetched and not yet accepted
      if (isValidIncident && !incident.isAccepted) {
        setState((prev) => ({
          ...prev,
          showIncomingModal: true,
        }));
      }
    };
    
    // Initial fetch
    loadIncident();
    
    // Set up polling every 3 seconds
    const intervalId = setInterval(loadIncident, 3000);
    
    // Cleanup interval on unmount
    return () => clearInterval(intervalId);
  }, []);

  const handleAcceptIncident = useCallback(() => {
    if (!incomingIncident) return;
    setState((prev) => ({
      ...prev,
      showIncomingModal: false,
      activeIncident: incomingIncident,
      currentStatus:
        (incomingIncident.status as IncidentStatus) || ('Ongoing' as IncidentStatus),
    }));
  }, [incomingIncident]);

  const handleDismissIncident = useCallback(() => {
    setState((prev) => ({
      ...prev,
      showIncomingModal: false,
    }));
  }, []);

  const handleUpdateStatus = useCallback((newStatus: IncidentStatus) => {
    setState((prev) => ({
      ...prev,
      currentStatus: newStatus,
    }));
  }, []);

  const handleToggleMapFullscreen = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isMapFullscreen: !prev.isMapFullscreen,
    }));
  }, []);

  const handleRestoreMapSize = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isMapFullscreen: false,
    }));
  }, []);

  const handleToggleChat = useCallback(() => {
    setState((prev) => {
      const nextShow = !prev.showChat;
      const reportId = prev.activeIncident?.id ?? '';
      const reportIdNum = Number(reportId);
      if (nextShow && Number.isFinite(reportIdNum) && reportIdNum > 0) {
        fetchChatMessages(String(reportIdNum)).then((messages) => {
          setState((current) => ({
            ...current,
            chatMessages: messages,
          }));
        });
      }
      return {
        ...prev,
        showChat: nextShow,
      };
    });
  }, []);

  const handleToggleHistory = useCallback(() => {
    setState((prev) => ({
      ...prev,
      showHistory: !prev.showHistory,
    }));
  }, []);

  const handleToggleTheme = useCallback(() => {
    setIsDarkMode((prev) => !prev);
  }, []);

  const handleLogin = useCallback((userData: any) => {
    console.log('Login successful:', userData);
    setIsLoggedIn(true);
  }, []);

  const handleLogout = useCallback(() => {
    setShowLogoutModal(true);
  }, []);

  const confirmLogout = useCallback(() => {
    setShowLogoutModal(false);
    setIsLoggedIn(false);
  }, []);

  const cancelLogout = useCallback(() => {
    setShowLogoutModal(false);
  }, []);

  const handleSendMessage = useCallback(
    async (message: string, images: string[]) => {
      const reportIdRaw = state.activeIncident?.id;
      const reportIdNum = Number(reportIdRaw);
      if (!Number.isFinite(reportIdNum) || reportIdNum <= 0) {
        console.warn('Invalid report id for chat send:', reportIdRaw);
        return;
      }

      if (!message.trim() && images.length === 0) return;

      const reportTitle = state.activeIncident?.type ?? 'Incident';

      try {
        if (images.length > 0) {
          for (const imageUri of images) {
            await addChatMessage(reportIdNum, {
              report_id: reportIdNum,
              name: reportTitle,
              message: message.trim() || 'Photo message',
              sender: 'user',
              timestamp: new Date().toISOString(),
              image: imageUri,
            });
          }
        } else {
          await addChatMessage(reportIdNum, {
            report_id: reportIdNum,
            name: reportTitle,
            message: message.trim(),
            sender: 'user',
            timestamp: new Date().toISOString(),
          });
        }

        const updatedChats = await fetchChatMessages(String(reportIdNum));
        setState((prev) => ({
          ...prev,
          chatMessages: updatedChats,
        }));
      } catch (err) {
        console.warn('Failed to send message:', err);
      }
    },
    [state.activeIncident]
  );

  const handleUpdateReportForm = useCallback((field: keyof ReportFormType, value: string) => {
    setState((prev) => ({
      ...prev,
      reportForm: {
        ...prev.reportForm,
        [field]: value,
      },
    }));
  }, []);

  const handleSubmitReport = useCallback(async () => {
    try {
      const incidentId = state.activeIncident?.id ?? undefined;
      await submitReportForm(state.reportForm, photoUri, incidentId);
      Alert.alert('Success', 'Report submitted successfully!');
      
      // Reset form after submission
      setState((prev) => ({
        ...prev,
        reportForm: {
          actionsTaken: '',
          timeArrived: '',
          timeCompleted: '',
          additionalNotes: '',
        },
      }));
      setPhotoUri(null);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to submit report. Please try again.');
    }
  }, [state.reportForm, photoUri, state.activeIncident]);

  // Request camera permission
  const requestCameraPermission = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Camera permission is required to take photos.');
        return false;
      }
      return true;
    } catch (error) {
      console.error('Error checking camera permission:', error);
      return false;
    }
  };

  // Take photo with camera
  const handleTakePhoto = useCallback(async () => {
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false, // Disabled to prevent crash on some Android devices
        quality: 0.6, // Reduced quality for better compatibility
        base64: false,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const uri = result.assets[0].uri;
        if (uri) {
          setPhotoUri(uri);
        }
      }
    } catch (error: any) {
      console.error('Error taking photo:', error);
      // Handle specific error types
      if (error.message && error.message.includes('canceled')) {
        // User canceled, no action needed
        return;
      }
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    }
  }, []);

  // Remove photo
  const handleRemovePhoto = useCallback(() => {
    setPhotoUri(null);
  }, []);

  const theme = {
    background: isDarkMode ? '#0F172A' : '#F8FAFC',
    surface: isDarkMode ? '#1E293B' : '#FFFFFF',
    surfaceAlt: isDarkMode ? '#334155' : '#E2E8F0',
    text: isDarkMode ? '#F8FAFC' : '#0F172A',
    textSecondary: isDarkMode ? '#94A3B8' : '#475569',
  };

  // Show loading screen while checking auto-login
  if (isAutoLoggingIn) {
    return (
      <ThemeProvider>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC' }}>
          <ActivityIndicator size="large" color={DEFAULT_CONFIG.primary_color} />
          <Text style={{ color: isDarkMode ? '#F8FAFC' : '#0F172A', marginTop: 16 }}>Checking login status...</Text>
        </View>
      </ThemeProvider>
    );
  }

  // Show login screen if not logged in
  if (!isLoggedIn) {
    return (
      <ThemeProvider>
        <LoginForm onLogin={handleLogin} isDarkMode={isDarkMode} />
      </ThemeProvider>
    );
  }

  const renderStatusBadge = () => {
    if (state.activeIncident) {
      const badgeStatus =
        (state.activeIncident.status as IncidentStatus | undefined) ?? state.currentStatus;
      const color = STATUS_COLORS[badgeStatus] || STATUS_COLORS[state.currentStatus];
      return (
        <View style={[styles.statusBadge, { backgroundColor: color }]}>
          <Text style={styles.statusBadgeText}>{badgeStatus}</Text>
        </View>
      );
    }
    return (
      <View style={[styles.statusBadge, { backgroundColor: theme.surfaceAlt }]}>
        <Text style={[styles.statusBadgeText, { color: theme.text }]}>Available</Text>
      </View>
    );
  };

  if (state.isMapFullscreen) {
    return (
      <ThemeProvider>
        <View style={[styles.fullscreenContainer, { backgroundColor: theme.background }]}>
          <StatusBar />
          <Map
            isDarkMode={isDarkMode}
            isFullscreen={state.isMapFullscreen}
            incident={state.activeIncident}
            onToggleFullscreen={handleToggleMapFullscreen}
            onRestoreSize={handleRestoreMapSize}
          />
        </View>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <Background />
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <StatusBar />

        {/* Header */}
        <View
          style={[
            styles.header,
            { backgroundColor: theme.surface, borderBottomColor: theme.surfaceAlt },
          ]}>
          <View style={styles.headerLeft}>
            <Pressable onPress={handleLogout} style={styles.logoutButton}>
              <Icon name="logout" size={20} color={theme.text} />
            </Pressable>
            <View style={[styles.headerIcon, { backgroundColor: DEFAULT_CONFIG.primary_color }]}>
              <Icon name="alert" size={24} color="#fff" />
            </View>
            <View>
              <Text style={[styles.headerTitle, { color: theme.text }]}>
                {DEFAULT_CONFIG.app_title}
              </Text>
              <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
                {DEFAULT_CONFIG.responder_name}
              </Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <Pressable
              onPress={handleToggleTheme}
              style={[styles.themeButton, { backgroundColor: theme.surfaceAlt }]}>
              <Icon name={isDarkMode ? 'moon' : 'sun'} size={22} color={theme.text} />
            </Pressable>
            {renderStatusBadge()}
          </View>
        </View>

        {/* Main Content */}
        <ScrollView
          style={styles.mainContent}
          contentContainerStyle={styles.mainContentContainer}
          showsVerticalScrollIndicator={false}
          scrollEnabled={!isMapInteracting}>
          <Map
            isDarkMode={isDarkMode}
            isFullscreen={state.isMapFullscreen}
            incident={state.activeIncident}
            onToggleFullscreen={handleToggleMapFullscreen}
            onRestoreSize={handleRestoreMapSize}
            onMapPress={() => setIsMapInteracting(true)}
            onMapRelease={() => setIsMapInteracting(false)}
          />

          {state.activeIncident ? (
            <>
              <QuickAccess
                onOpenChat={handleToggleChat}
                onOpenHistory={handleToggleHistory}
                currentStatus={state.currentStatus}
                isDarkMode={isDarkMode}
                onUpdateStatus={handleUpdateStatus}
              />
              <IncidentDetails
                incident={state.activeIncident}
                responderName={DEFAULT_CONFIG.responder_name}
                isDarkMode={isDarkMode}
              />
              <StatusTracker
                incidentId={state.activeIncident.id}
                onUpdateStatus={handleUpdateStatus}
                isDarkMode={isDarkMode}
              />
              {state.currentStatus === 'Completed' && (
                <ReportForm
                  form={state.reportForm}
                  onUpdateForm={handleUpdateReportForm}
                  onSubmit={handleSubmitReport}
                  photoUri={photoUri}
                  onTakePhoto={handleTakePhoto}
                  onRemovePhoto={handleRemovePhoto}
                  isDarkMode={isDarkMode}
                />
              )}
              <ActionBar onOpenChat={handleToggleChat} onOpenHistory={handleToggleHistory} />
            </>
          ) : (
            <View style={styles.noIncidentContainer}>
              <Text style={[styles.noIncidentText, { color: theme.textSecondary }]}>No active incident</Text>
              <Pressable
                style={[styles.historyButton, { backgroundColor: theme.surface }]}
                onPress={handleToggleHistory}>
                <Icon name="history" size={20} color={theme.text} />
                <Text style={[styles.historyButtonText, { color: theme.text }]}>History</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>

        {/* Modals */}
        {incomingIncident !== null && (
          <IncomingModal
            visible={state.showIncomingModal}
            incident={incomingIncident}
            onAccept={handleAcceptIncident}
            onDismiss={handleDismissIncident}
          />
        )}

        <ChatModal
          visible={state.showChat}
          messages={state.chatMessages}
          onClose={handleToggleChat}
          onSendMessage={handleSendMessage}
          isDarkMode={isDarkMode}
        />

        <HistoryModal visible={state.showHistory} onClose={handleToggleHistory} isDarkMode={isDarkMode} />

        {/* Logout Confirmation Modal */}
        <Modal
          transparent
          visible={showLogoutModal}
          animationType="fade"
          onRequestClose={cancelLogout}
        >
          <Pressable style={styles.modalOverlay} onPress={cancelLogout}>
            <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Logout</Text>
              <Text style={[styles.modalMessage, { color: theme.textSecondary }]}>
                Are you sure you want to logout?
              </Text>
              <View style={styles.modalButtons}>
                <Pressable
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={cancelLogout}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[styles.modalButton, styles.confirmButton]}
                  onPress={confirmLogout}
                >
                  <Text style={styles.confirmButtonText}>Logout</Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      </SafeAreaView>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  fullscreenContainer: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoutButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 12,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  themeButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
  },
  statusBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  mainContent: {
    flex: 1,
  },
  mainContentContainer: {
    padding: 16,
    gap: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 24,
    width: '80%',
    borderWidth: 1,
    borderColor: '#334155',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalMessage: {
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
    backgroundColor: '#334155',
  },
  confirmButton: {
    backgroundColor: '#EF4444',
  },
  cancelButtonText: {
    color: '#F8FAFC',
    fontWeight: '600',
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  noIncidentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingVertical: 16,
  },
  noIncidentText: {
    fontSize: 14,
  },
  historyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  historyButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

