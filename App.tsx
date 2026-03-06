import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Modal,
  Alert,
  Image,
  useWindowDimensions,
  Platform,
  AppState as RNAppState,
} from 'react-native';
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
import { getCredentials, login, logout } from './components/lib/auth';
import { sendLocation, stopLocationUpdates, submitReportForm } from './components/lib/axios';
import { locationService } from './components/services/locationService';
import {
  fetchIncomingIncident,
  fetchChatMessages,
  addChatMessage,
  DEFAULT_CONFIG,
  STATUS_COLORS,
} from './src/mockData';
import {
  AppState as ResponderAppState,
  ReportForm as ReportFormType,
  IncidentStatus,
  Incident,
} from './src/types';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Background from 'Background';
import * as Location from 'expo-location';
import {
  consumePendingOverlayNavigation,
  openOverlayPermissionSettings,
  setOverlayBubbleVisible,
  startOverlayLocationService,
  stopOverlayLocationService,
} from './components/services/OverlayLocationService';
import type { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import FirebaseNotificationService from './services/FirebaseNotificationService';

const AppContent = () => {
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const scrollViewRef = useRef<ScrollView>(null);
  const statusTrackerYRef = useRef(0);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isAutoLoggingIn, setIsAutoLoggingIn] = useState(true);
  const [userName, setUserName] = useState(DEFAULT_CONFIG.responder_name);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);

  const [state, setState] = useState<ResponderAppState>({
    showIncomingModal: false,
    activeIncident: null,
    currentStatus: 'Active',
    isMapFullscreen: false,
    showChat: false,
    showHistory: false,
    isDarkMode: isDarkMode,
    chatMessages: [],
    activeChatTab: 'dispatcher',
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
  const overlayPermissionPromptShownRef = useRef(false);
  const stateRef = useRef(state);
  const refreshIncomingIncidentRef = useRef<() => Promise<void>>(async () => {});
  const openReportChatFromOverlayRef = useRef<(reportId: number) => Promise<void>>(async () => {});

  const resolveUserName = useCallback((userData: any) => {
    return (
      userData?.user?.name ??
      userData?.user?.full_name ??
      userData?.name ??
      DEFAULT_CONFIG.responder_name
    );
  }, []);

  const resetIncidentState = useCallback(() => {
    setIncomingIncident(null);
    setPhotoUri(null);
    setState((prev) => ({
      ...prev,
      showIncomingModal: false,
      activeIncident: null,
      currentStatus: 'Active',
      showChat: false,
      chatMessages: [],
      activeChatTab: 'dispatcher',
      reportForm: {
        actionsTaken: '',
        timeArrived: '',
        timeCompleted: '',
        additionalNotes: '',
      },
    }));
  }, []);

  const buildOverlayIncident = useCallback((reportId: number): Incident => {
    return {
      id: String(reportId),
      type: `Report #${reportId}`,
      location: 'Unknown',
      coordinates: null,
      timeReported: new Date().toISOString(),
      description: '',
      priority: 'Medium',
      caller: 'Unknown',
      callerPhone: '',
      icon: 'warning',
      report_attachment: '',
      isAccepted: true,
      receiver_id: null,
      dispatcher_id: null,
      citizen_id: null,
    };
  }, []);

  const openReportChatFromOverlay = useCallback(
    async (reportId: number) => {
      if (!Number.isFinite(reportId) || reportId <= 0) {
        return;
      }

      const activeMatch = String(state.activeIncident?.id ?? '').match(/\d+/);
      const activeReportId = activeMatch ? Number(activeMatch[0]) : 0;
      let incidentForChat: Incident | null =
        activeReportId === reportId ? state.activeIncident : null;

      if (!incidentForChat) {
        try {
          const latestIncident = await fetchIncomingIncident();
          const latestMatch = String(latestIncident?.id ?? '').match(/\d+/);
          const latestReportId = latestMatch ? Number(latestMatch[0]) : 0;
          if (latestReportId === reportId) {
            incidentForChat = latestIncident;
          }
        } catch (error) {
          console.warn('Unable to resolve latest incident for overlay chat:', error);
        }
      }

      const resolvedIncident = incidentForChat ?? buildOverlayIncident(reportId);
      const messages = await fetchChatMessages(String(reportId));

      setIncomingIncident(resolvedIncident);
      setState((prev) => ({
        ...prev,
        showIncomingModal: false,
        activeIncident: resolvedIncident,
        showChat: true,
        activeChatTab: 'citizen',
        chatMessages: messages,
      }));
    },
    [buildOverlayIncident, state.activeIncident]
  );

  const consumeOverlayNavigationIfAny = useCallback(async () => {
    if (Platform.OS !== 'android') {
      return;
    }

    const pending = await consumePendingOverlayNavigation();
    if (!pending?.reportId) {
      return;
    }

    if (pending.screen === 'ReportChats') {
      await openReportChatFromOverlay(pending.reportId);
    }
  }, [openReportChatFromOverlay]);

  const syncOverlayStateForAppState = useCallback(
    async (nextState: string) => {
      if (Platform.OS !== 'android') {
        return;
      }

      if (!isLoggedIn) {
        await stopOverlayLocationService();
        return;
      }

      const existingPermission = await Location.getForegroundPermissionsAsync();
      let locationStatus = existingPermission.status;
      if (locationStatus !== 'granted' && existingPermission.canAskAgain) {
        const request = await Location.requestForegroundPermissionsAsync();
        locationStatus = request.status;
      }

      if (locationStatus !== 'granted') {
        return;
      }

      const overlayStatus = await startOverlayLocationService();
      if (overlayStatus === 'permission_missing') {
        if (nextState === 'active' && !overlayPermissionPromptShownRef.current) {
          overlayPermissionPromptShownRef.current = true;
          Alert.alert(
            'Enable Floating Location Bubble',
            'Allow "Display over other apps" so the floating location button can work like Messenger chat heads.',
            [
              { text: 'Not now', style: 'cancel' },
              {
                text: 'Open settings',
                onPress: () => {
                  void openOverlayPermissionSettings();
                },
              },
            ]
          );
        }
        return;
      }

      if (overlayStatus === 'started') {
        overlayPermissionPromptShownRef.current = false;
        const shouldShowBubble = nextState !== 'active';
        await setOverlayBubbleVisible(shouldShowBubble);
        if (!shouldShowBubble) {
          await consumeOverlayNavigationIfAny();
        }
      }
    },
    [consumeOverlayNavigationIfAny, isLoggedIn]
  );

  const refreshIncomingIncident = useCallback(async () => {
    const incident = await fetchIncomingIncident();
    const incidentIdNum = Number(incident?.id ?? 0);
    const hasValidIncident = Number.isFinite(incidentIdNum) && incidentIdNum > 0;

    if (!hasValidIncident) {
      resetIncidentState();
      return;
    }

    if (incident.id !== '0' && incident.id !== 'unknown' && incident.isAccepted === true && incident.isAccepted !== null) {
      setIncomingIncident(incident);
      setState((prev) => ({
        ...prev,
        showIncomingModal: false,
        activeIncident: incident,
        currentStatus: 'Active',
      }));
      return;
    }

    setIncomingIncident(incident);
    console.log(`is VALID: ${incident.id}`);

    if (incident.id !== '0' && incident.id !== 'unknown' && incident.isAccepted === false) {
      setState((prev) => ({
        ...prev,
        showIncomingModal: true,
      }));
    }
  }, [resetIncidentState]);

  const handleForegroundNotification = useCallback(
    async (remoteMessage: FirebaseMessagingTypes.RemoteMessage) => {
      const notificationType = remoteMessage.data?.notification_type ?? '';
      const reportIdRaw =
        remoteMessage.data?.report_id ??
        remoteMessage.data?.incident_id ??
        remoteMessage.data?.reportId;
      const reportId = Number(reportIdRaw);
      const currentState = stateRef.current;

      if (notificationType === 'new_message' && Number.isFinite(reportId) && reportId > 0) {
        const activeReportId = Number(currentState.activeIncident?.id ?? 0);
        if (currentState.showChat || activeReportId === reportId) {
          try {
            const messages = await fetchChatMessages(String(reportId));
            setState((prev) => {
              const currentActiveReportId = Number(prev.activeIncident?.id ?? 0);
              if (currentActiveReportId !== reportId) {
                return prev;
              }

              return {
                ...prev,
                chatMessages: messages,
              };
            });
          } catch (error) {
            console.warn('Failed to refresh chat after foreground notification:', error);
          }
        }
      }

      await refreshIncomingIncidentRef.current();
    },
    []
  );

  const handleNotificationOpen = useCallback(
    async (remoteMessage: FirebaseMessagingTypes.RemoteMessage) => {
      const notificationType = remoteMessage.data?.notification_type ?? '';
      const reportIdRaw =
        remoteMessage.data?.report_id ??
        remoteMessage.data?.incident_id ??
        remoteMessage.data?.reportId;
      const reportId = Number(reportIdRaw);

      if (notificationType === 'new_message' && Number.isFinite(reportId) && reportId > 0) {
        await openReportChatFromOverlayRef.current(reportId);
        return;
      }

      await refreshIncomingIncidentRef.current();
    },
    []
  );

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    refreshIncomingIncidentRef.current = refreshIncomingIncident;
  }, [refreshIncomingIncident]);

  useEffect(() => {
    openReportChatFromOverlayRef.current = openReportChatFromOverlay;
  }, [openReportChatFromOverlay]);

  useEffect(() => {
    const reportIdRaw = state.activeIncident?.id;
    const reportIdMatch = String(reportIdRaw ?? '').match(/\d+/);
    const reportIdValue = reportIdMatch ? Number(reportIdMatch[0]) : undefined;
    const hasValidReportId =
      typeof reportIdValue === 'number' && Number.isFinite(reportIdValue) && reportIdValue > 0;
    const shouldSendLocation = isLoggedIn;

    if (!shouldSendLocation) {
      stopLocationUpdates();
      return;
    }

    let isMounted = true;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let isSending = false;

    const sendCurrentLocation = async () => {
      if (isSending || !isMounted) return;
      isSending = true;
      try {
        const location = await locationService.getCurrentLocation(true);
        if (!isMounted) return;
        await sendLocation(
          { lat: location.latitude, lng: location.longitude },
          { repeat: false },
          hasValidReportId ? Number(reportIdValue) : undefined
        );
      } catch (error) {
        console.log('[Location] Failed to send location:', error);
      } finally {
        isSending = false;
      }
    };

    sendCurrentLocation();
    intervalId = setInterval(sendCurrentLocation, 2800);

    return () => {
      isMounted = false;
      if (intervalId) {
        clearInterval(intervalId);
      }
      stopLocationUpdates();
    };
  }, [isLoggedIn, state.currentStatus, state.activeIncident?.id]);

  useEffect(() => {
    if (Platform.OS !== 'android') {
      return;
    }

    void syncOverlayStateForAppState(RNAppState.currentState);

    const appStateSubscription = RNAppState.addEventListener('change', (nextState) => {
      void syncOverlayStateForAppState(nextState);
    });

    return () => {
      appStateSubscription.remove();
    };
  }, [syncOverlayStateForAppState]);

  useEffect(() => {
    void FirebaseNotificationService.initialize({
      onForegroundMessage: (remoteMessage) => handleForegroundNotification(remoteMessage),
      onNotificationOpened: (remoteMessage) => handleNotificationOpen(remoteMessage),
    });

    return () => {
      FirebaseNotificationService.cleanup();
    };
  }, [handleForegroundNotification, handleNotificationOpen]);

  useEffect(() => {
    if (!isLoggedIn) {
      return;
    }

    void FirebaseNotificationService.syncCurrentToken();
  }, [isLoggedIn]);

  // Auto-login on app start
  useEffect(() => {
    const attemptAutoLogin = async () => {
      try {
        const credentials = await getCredentials();
        if (credentials && credentials.email && credentials.password) {
          console.log('Auto-login with stored credentials');
          const userData = await login(credentials.email, credentials.password);
          setUserName(resolveUserName(userData));
          setCurrentUserId(Number(userData?.user?.id ?? userData?.id ?? 0) || null);
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
    // Initial fetch
    void refreshIncomingIncident();

    // Set up polling every 3 seconds
    const intervalId = setInterval(() => {
      void refreshIncomingIncident();
    }, 3000);

    // Cleanup interval on unmount
    return () => clearInterval(intervalId);
  }, [refreshIncomingIncident]);

  const handleAcceptIncident = useCallback(() => {
    if (!incomingIncident) return;
    setState((prev) => ({
      ...prev,
      showIncomingModal: false,
      activeIncident: incomingIncident,
      currentStatus: 'Active',
    }));
  }, [incomingIncident]);

  const handleDismissIncident = useCallback(() => {
    setState((prev) => ({
      ...prev,
      showIncomingModal: false,
    }));
  }, []);

  const handleUpdateStatus = useCallback((newStatus: IncidentStatus) => {
    if (newStatus === 'Cleared') {
      resetIncidentState();
      return;
    }
    setState((prev) => ({
      ...prev,
      currentStatus: newStatus,
    }));
  }, [resetIncidentState]);

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
            activeChatTab: current.activeChatTab ?? 'citizen',
          }));
        });
      }
      return {
        ...prev,
        showChat: nextShow,
      };
    });
  }, []);

  const handleOpenHistory = useCallback(() => {
    setState((prev) => {
      if (prev.showHistory) {
        return prev;
      }
      return {
        ...prev,
        showHistory: true,
      };
    });
  }, []);

  const handleCloseHistory = useCallback(() => {
    setState((prev) => {
      if (!prev.showHistory) {
        return prev;
      }
      return {
        ...prev,
        showHistory: false,
      };
    });
  }, []);

  const handleToggleTheme = useCallback(() => {
    setIsDarkMode((prev) => !prev);
  }, []);

  const handleScrollToStatus = useCallback(() => {
    scrollViewRef.current?.scrollTo({
      y: Math.max(statusTrackerYRef.current - 8, 0),
      animated: true,
    });
  }, []);

  const handleLogin = useCallback((userData: any) => {
    console.log('Login successful:', userData);
    setUserName(resolveUserName(userData));
    setCurrentUserId(Number(userData?.user?.id ?? userData?.id ?? 0) || null);
    setIsLoggedIn(true);
  }, [resolveUserName]);

  const handleLogout = useCallback(() => {
    setShowLogoutModal(true);
  }, []);

  const confirmLogout = useCallback(async () => {
    setShowLogoutModal(false);
    await logout();
    stopLocationUpdates();
    await stopOverlayLocationService();
    resetIncidentState();
    setState((prev) => ({
      ...prev,
      showHistory: false,
      isMapFullscreen: false,
      historySearch: '',
      historyFilter: { type: 'all', status: 'all' },
      newMessage: '',
    }));
    setIsLoggedIn(false);
    setUserName(DEFAULT_CONFIG.responder_name);
    setCurrentUserId(null);
  }, [resetIncidentState]);

  const cancelLogout = useCallback(() => {
    setShowLogoutModal(false);
  }, []);

  const renderLogoutModal = () => (
    <Modal
      transparent
      visible={showLogoutModal}
      animationType="fade"
      onRequestClose={cancelLogout}>
      <TouchableOpacity style={styles.modalOverlay} onPress={cancelLogout}>
        <TouchableOpacity style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
          <Text style={[styles.modalTitle, { color: theme.text }]}>Logout</Text>
          <Text style={[styles.modalMessage, { color: theme.textSecondary }]}>
            Are you sure you want to logout?
          </Text>
          <View style={styles.modalButtons}>
            <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={cancelLogout}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, styles.confirmButton]}
              onPress={confirmLogout}>
              <Text style={styles.confirmButtonText}>Logout</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
        
      </TouchableOpacity>
    </Modal>
  );

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
      const receiverId =
        state.activeChatTab === 'dispatcher'
          ? state.activeIncident?.dispatcher_id ?? undefined
          : state.activeIncident?.citizen_id ?? state.activeIncident?.receiver_id ?? undefined;
      const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const tempIds: number[] = [];

      try {
        if (images.length > 0) {
          const optimisticMessages = images.map((imageUri, idx) => {
            const tempId = Date.now() + idx;
            tempIds.push(tempId);
            return {
              id: tempId,
              sender: DEFAULT_CONFIG.responder_name,
              message: message.trim() || 'Photo message',
              time: nowTime,
              isUser: true,
              image: imageUri,
              status: 'sending' as const,
            };
          });
          setState((prev) => ({
            ...prev,
            chatMessages: [...prev.chatMessages, ...optimisticMessages],
          }));
          for (const imageUri of images) {
            await addChatMessage(reportIdNum, {
              report_id: reportIdNum,
              name: reportTitle,
              message: message.trim() || 'Photo message',
              sender: 'user',
              timestamp: new Date().toISOString(),
              image: imageUri,
              receiver_id: receiverId,
            });
          }
        } else {
          const tempId = Date.now();
          tempIds.push(tempId);
          setState((prev) => ({
            ...prev,
            chatMessages: [
              ...prev.chatMessages,
              {
                id: tempId,
                sender: DEFAULT_CONFIG.responder_name,
                message: message.trim(),
                time: nowTime,
                isUser: true,
                status: 'sending',
              },
            ],
          }));
          await addChatMessage(reportIdNum, {
            report_id: reportIdNum,
            name: reportTitle,
            message: message.trim(),
            sender: 'user',
            timestamp: new Date().toISOString(),
            receiver_id: receiverId,
          });
        }

        const updatedChats = await fetchChatMessages(String(reportIdNum));
        setState((prev) => ({
          ...prev,
          chatMessages: updatedChats.map((chat) =>
            chat.isUser ? { ...chat, status: 'sent' } : chat
          ),
        }));
      } catch (err) {
        console.warn('Failed to send message:', err);
        if (tempIds.length > 0) {
          setState((prev) => ({
            ...prev,
            chatMessages: prev.chatMessages.map((msg) =>
              tempIds.includes(msg.id) ? { ...msg, status: 'failed' } : msg
            ),
          }));
        }
        Alert.alert('Error', 'Failed to send message. Please try again.');
      }
    },
    [state.activeChatTab, state.activeIncident]
  );
  const handleChangeChatTab = useCallback((tab: 'dispatcher' | 'citizen') => {
    setState((prev) => ({
      ...prev,
      activeChatTab: tab,
    }));
  }, []);

  const filteredChatMessages = useMemo(() => {
    const activeTab = state.activeChatTab ?? 'citizen';
    const selfId = currentUserId;
    const dispatcherId = state.activeIncident?.dispatcher_id ?? null;
    const citizenId = state.activeIncident?.citizen_id ?? state.activeIncident?.receiver_id ?? null;

    if (!selfId) {
      return state.chatMessages;
    }

    return state.chatMessages.filter((msg) => {
      const senderId = msg.sender_id ?? null;
      const receiverId = msg.receiver_id ?? null;
      const peerId = senderId === selfId ? receiverId : senderId;

      if (activeTab === 'dispatcher') {
        return dispatcherId ? peerId === dispatcherId : true;
      }

      return citizenId ? peerId === citizenId : true;
    });
  }, [currentUserId, state.activeChatTab, state.activeIncident?.citizen_id, state.activeIncident?.dispatcher_id, state.activeIncident?.receiver_id, state.chatMessages]);
  const theme = {
    background: isDarkMode ? '#0F172A' : '#F8FAFC',
    surface: isDarkMode ? '#1E293B' : '#FFFFFF',
    surfaceAlt: isDarkMode ? '#334155' : '#E2E8F0',
    text: isDarkMode ? '#F8FAFC' : '#0F172A',
    textSecondary: isDarkMode ? '#94A3B8' : '#475569',
  };
  const isStatusCompleted = state.currentStatus === 'Completed';
  const mapShouldBeFullscreen = state.isMapFullscreen || isStatusCompleted;
  const isLandscape = screenWidth > screenHeight;
  const landscapeMapHeight = Math.max(screenHeight - insets.top - 128, 280);

  // Show loading screen while checking auto-login
  if (isAutoLoggingIn) {
    return (
      <ThemeProvider>
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC',
          }}>
          <ActivityIndicator size="large" color={DEFAULT_CONFIG.primary_color} />
          <Text style={{ color: isDarkMode ? '#F8FAFC' : '#0F172A', marginTop: 16 }}>
            Checking login status...
          </Text>
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
      const badgeStatus = state.currentStatus;
      const color = STATUS_COLORS[badgeStatus] || STATUS_COLORS.Pending;
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

  const renderHeader = (overlay = false) => (
    <View
      style={[
        styles.header,
        { backgroundColor: theme.surface, borderBottomColor: theme.surfaceAlt },
        overlay && { paddingTop: insets.top },
        overlay && styles.headerOverlay,
      ]}>
      <View style={styles.headerLeft}>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <Icon name="logout" size={20} color={theme.text} />
        </TouchableOpacity>
        <View style={[styles.headerIcon, { backgroundColor: DEFAULT_CONFIG.primary_color }]}>
          <Image source={require('./assets/icon.png')} style={styles.headerLogo} />
        </View>
        <View>
          <Text style={[styles.headerTitle, { color: theme.text }]}>{DEFAULT_CONFIG.app_title}</Text>
          <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
            {userName}
          </Text>
        </View>
      </View>
      <View style={styles.headerRight}>
        <TouchableOpacity
          onPress={handleToggleTheme}
          style={[styles.themeButton, { backgroundColor: theme.surfaceAlt }]}>
          <Icon name={isDarkMode ? 'moon' : 'sun'} size={22} color={theme.text} />
        </TouchableOpacity>
        {renderStatusBadge()}
      </View>
    </View>
  );

  if (isLandscape) {
    return (
      <ThemeProvider>
        <Background />
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
          <StatusBar />
          {renderHeader()}

          <View style={styles.landscapeContent}>
            <View style={styles.landscapeMapPane}>
              <Map
                isDarkMode={isDarkMode}
                isFullscreen={false}
                incident={state.activeIncident}
                onToggleFullscreen={handleToggleMapFullscreen}
                onRestoreSize={handleRestoreMapSize}
                onMapPress={() => setIsMapInteracting(true)}
                onMapRelease={() => setIsMapInteracting(false)}
                showFullscreenToggle={false}
                mapHeight={landscapeMapHeight}
              />
            </View>

            <View
              style={[
                styles.landscapeSidePane,
                { backgroundColor: theme.surface, borderColor: theme.surfaceAlt },
              ]}>
              {state.activeIncident ? (
                <ScrollView
                  style={styles.landscapePanelScroll}
                  contentContainerStyle={styles.landscapePanelScrollContent}
                  showsVerticalScrollIndicator={false}>
                  <Text style={[styles.landscapePanelTitle, { color: theme.text }]}>Menu</Text>
                  <Text style={[styles.landscapePanelSubtitle, { color: theme.textSecondary }]}>
                    {state.activeIncident.type}
                  </Text>
                  <ActionBar onOpenChat={handleToggleChat} onOpenHistory={handleOpenHistory} />
                  <Text style={[styles.landscapeSectionTitle, { color: theme.text }]}>
                    Status Timeline
                  </Text>
                  <StatusTracker
                    incidentId={state.activeIncident.id}
                    onUpdateStatus={handleUpdateStatus}
                    isDarkMode={isDarkMode}
                  />
                </ScrollView>
              ) : (
                <View style={styles.landscapeHistoryPanel}>
                  <Text style={[styles.landscapePanelTitle, { color: theme.text }]}>Menu</Text>
                  <Text style={[styles.landscapePanelSubtitle, { color: theme.textSecondary }]}>
                    No active report. Open incident history.
                  </Text>
                  <TouchableOpacity
                    style={[
                      styles.landscapeHistoryButton,
                      { backgroundColor: DEFAULT_CONFIG.primary_color },
                    ]}
                    onPress={handleOpenHistory}>
                    <Icon name="history" size={20} color="#fff" />
                    <Text style={styles.landscapeHistoryButtonText}>Open History</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>

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
            messages={filteredChatMessages}
            onClose={handleToggleChat}
            onSendMessage={handleSendMessage}
            isDarkMode={isDarkMode}
            chatTabs={[
              { key: 'dispatcher', label: 'Dispatcher' },
              { key: 'citizen', label: 'Citizen' },
            ]}
            activeChatTab={state.activeChatTab ?? 'citizen'}
            onChangeChatTab={handleChangeChatTab}
          />

          <HistoryModal
            visible={state.showHistory}
            onClose={handleCloseHistory}
            isDarkMode={isDarkMode}
          />

          {renderLogoutModal()}
        </SafeAreaView>
      </ThemeProvider>
    );
  }

  if (state.isMapFullscreen) {
    return (
      <ThemeProvider>
        <View style={[styles.fullscreenContainer, { backgroundColor: theme.background }]}>
          <StatusBar />
          {renderHeader(true)}
          <Map
            isDarkMode={isDarkMode}
            isFullscreen={true}
            incident={state.activeIncident}
            onToggleFullscreen={handleToggleMapFullscreen}
            onRestoreSize={handleRestoreMapSize}
            showFullscreenToggle={!isStatusCompleted}
          />
          {renderLogoutModal()}
        </View>
      </ThemeProvider>
    );
  }

  if (!state.activeIncident) {
    return (
      <ThemeProvider>
        <View style={[styles.fullscreenContainer, { backgroundColor: theme.background }]}>
          <StatusBar />
          {renderHeader(true)}
          <Map
            isDarkMode={isDarkMode}
            isFullscreen={true}
            incident={null}
            onToggleFullscreen={() => {}}
            onRestoreSize={() => {}}
            onMapPress={() => setIsMapInteracting(true)}
            onMapRelease={() => setIsMapInteracting(false)}
            showFullscreenToggle={false}
          />

          <TouchableOpacity
            style={[styles.floatingHistoryButton, { backgroundColor: theme.surface }]}
            onPress={handleOpenHistory}>
            <Icon name="history" size={26} color={theme.text} />
          </TouchableOpacity>

          {incomingIncident !== null && (
            <IncomingModal
              visible={state.showIncomingModal}
              incident={incomingIncident}
              onAccept={handleAcceptIncident}
              onDismiss={handleDismissIncident}
            />
          )}

          <HistoryModal
            visible={state.showHistory}
            onClose={handleCloseHistory}
            isDarkMode={isDarkMode}
          />
          {renderLogoutModal()}
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
        {renderHeader()}

        {/* Main Content */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.mainContent}
          contentContainerStyle={styles.mainContentContainer}
          showsVerticalScrollIndicator={false}
          scrollEnabled={!isMapInteracting}>
          <Map
            isDarkMode={isDarkMode}
            isFullscreen={mapShouldBeFullscreen}
            incident={state.activeIncident}
            onToggleFullscreen={isStatusCompleted ? () => {} : handleToggleMapFullscreen}
            onRestoreSize={handleRestoreMapSize}
            onMapPress={() => setIsMapInteracting(true)}
            onMapRelease={() => setIsMapInteracting(false)}
            showFullscreenToggle={!isStatusCompleted}
          />

          {state.activeIncident ? (
            <>
              {state.currentStatus !== 'Completed' && (
                <QuickAccess
                  onOpenChat={handleToggleChat}
                  onOpenHistory={handleOpenHistory}
                  onOpenStatus={handleScrollToStatus}
                  currentStatus={state.currentStatus}
                  isDarkMode={isDarkMode}
                  onUpdateStatus={handleUpdateStatus}
                />
              )}
              <IncidentDetails
                incident={state.activeIncident}
                responderName={DEFAULT_CONFIG.responder_name}
                isDarkMode={isDarkMode}
              />
              <View
                onLayout={(event) => {
                  statusTrackerYRef.current = event.nativeEvent.layout.y;
                }}>
                <StatusTracker
                  incidentId={state.activeIncident.id}
                  onUpdateStatus={handleUpdateStatus}
                  isDarkMode={isDarkMode}
                />
              </View>
              <ActionBar onOpenChat={handleToggleChat} onOpenHistory={handleOpenHistory} />
            </>
          ) : (
            <View style={styles.noIncidentContainer}>
              <TouchableOpacity
                style={[styles.historyButton, { backgroundColor: theme.surface }]}
                onPress={handleOpenHistory}>
                <Icon name="history" size={20} color={theme.text} />
                <Text style={[styles.historyButtonText, { color: theme.text }]}>History</Text>
              </TouchableOpacity>
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
          messages={filteredChatMessages}
          onClose={handleToggleChat}
          onSendMessage={handleSendMessage}
          isDarkMode={isDarkMode}
          chatTabs={[
            { key: 'dispatcher', label: 'Dispatcher' },
            { key: 'citizen', label: 'Citizen' },
          ]}
          activeChatTab={state.activeChatTab ?? 'citizen'}
          onChangeChatTab={handleChangeChatTab}
        />

        <HistoryModal
          visible={state.showHistory}
          onClose={handleCloseHistory}
          isDarkMode={isDarkMode}
        />

        {renderLogoutModal()}
      </SafeAreaView>
    </ThemeProvider>
  );
};

export default function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
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
  headerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
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
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerLogo: {
    width: 40,
    height: 40,
    borderRadius: 40,
    resizeMode: 'contain',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 9,
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
  landscapeContent: {
    flex: 1,
    flexDirection: 'row',
    gap: 16,
    padding: 16,
  },
  landscapeMapPane: {
    flex: 1.8,
  },
  landscapeSidePane: {
    flex: 1,
    minWidth: 280,
    maxWidth: 380,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  landscapePanelScroll: {
    flex: 1,
  },
  landscapePanelScrollContent: {
    padding: 12,
    gap: 12,
  },
  landscapePanelTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  landscapePanelSubtitle: {
    fontSize: 12,
    marginBottom: 8,
  },
  landscapeSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
  },
  landscapeHistoryPanel: {
    flex: 1,
    padding: 14,
    justifyContent: 'center',
    gap: 12,
  },
  landscapeHistoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  landscapeHistoryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
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
  floatingHistoryButton: {
    position: 'absolute',
    right: 16,
    top: 150,
    width: 46,
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    display: 'flex',
    justifyContent: 'center',
    borderRadius: 50,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  floatingHistoryText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
