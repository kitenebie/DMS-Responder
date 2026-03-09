import 'react-native-gesture-handler';
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
  Linking,
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ThemeProvider } from './components/ThemeContext';
import { LoginForm } from './components/LoginForm';
import { Map } from './components/Map';
import { IncomingModal } from './components/IncomingModal';
import { IncidentDetails } from './components/IncidentDetails';
import { StatusTracker } from './components/StatusTracker';
import { ChatScreen } from './components/ChatScreen';
import { HistoryScreen } from './components/HistoryScreen';
import { ReportScreen } from './components/ReportScreen';
import { ActionBar } from './components/ActionBar';
import { QuickAccess } from './components/QuickAccess';
import { Icon } from './components/Icon';
import { navigationRef, navigate } from './components/lib/NavigationService';
import { getCredentials, login, logout } from './components/lib/auth';
import { sendLocation, stopLocationUpdates } from './components/lib/axios';
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
  IncidentStatus,
  Incident,
  ChatMessage,
} from './src/types';
import { RootStackParamList } from './src/navigation/types';
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

const Stack = createNativeStackNavigator<RootStackParamList>();

const AppContent = () => {
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const scrollViewRef = useRef<ScrollView>(null);
  const statusTrackerYRef = useRef(0);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isAutoLoggingIn, setIsAutoLoggingIn] = useState(true);
  const [userName, setUserName] = useState(DEFAULT_CONFIG.responder_name);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [isNavigationReady, setIsNavigationReady] = useState(false);
  const [chatScreenMode, setChatScreenMode] = useState<'live' | 'history'>('live');
  const [historyChatMessages, setHistoryChatMessages] = useState<ChatMessage[]>([]);
  const [historyChatTitle, setHistoryChatTitle] = useState('Incident Chat');

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
  const overlayPermissionPromptShownRef = useRef(false);
  const locationPermissionPromptShownRef = useRef(false);
  const stateRef = useRef(state);
  const chatScreenModeRef = useRef(chatScreenMode);
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
    setChatScreenMode('live');
    setHistoryChatMessages([]);
    setHistoryChatTitle('Incident Chat');
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
      setChatScreenMode('live');
      setState((prev) => ({
        ...prev,
        showIncomingModal: false,
        activeIncident: resolvedIncident,
        showChat: true,
        activeChatTab: 'citizen',
        chatMessages: messages,
      }));
      navigate('Chat');
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

  const promptForBackgroundLocationSettings = useCallback((message: string) => {
    if (locationPermissionPromptShownRef.current) {
      return;
    }

    locationPermissionPromptShownRef.current = true;
    Alert.alert(
      'Allow "All the time" Location',
      message,
      [
        {
          text: 'Not now',
          style: 'cancel',
          onPress: () => {
            locationPermissionPromptShownRef.current = false;
          },
        },
        {
          text: 'Open settings',
          onPress: () => {
            locationPermissionPromptShownRef.current = false;
            void Linking.openSettings();
          },
        },
      ],
      {
        cancelable: true,
        onDismiss: () => {
          locationPermissionPromptShownRef.current = false;
        },
      }
    );
  }, []);

  const ensureAndroidBackgroundLocationPermission = useCallback(
    async (interactive = false): Promise<boolean> => {
      if (Platform.OS !== 'android') {
        return true;
      }

      let foregroundPermission = await Location.getForegroundPermissionsAsync();
      if (foregroundPermission.status !== 'granted') {
        if (!interactive) {
          return false;
        }

        if (!foregroundPermission.canAskAgain) {
          promptForBackgroundLocationSettings(
            'Set location access to "Allow all the time" so the responder overlay can keep updating your position even while the app is minimized.'
          );
          return false;
        }

        foregroundPermission = await Location.requestForegroundPermissionsAsync();
        if (foregroundPermission.status !== 'granted') {
          if (!foregroundPermission.canAskAgain) {
            promptForBackgroundLocationSettings(
              'Location access is currently blocked. Open app settings and change it to "Allow all the time" for background responder tracking.'
            );
          }
          return false;
        }
      }

      let backgroundPermission = await Location.getBackgroundPermissionsAsync();
      if (backgroundPermission.status === 'granted') {
        locationPermissionPromptShownRef.current = false;
        return true;
      }

      if (!interactive) {
        return false;
      }

      if (!backgroundPermission.canAskAgain) {
        promptForBackgroundLocationSettings(
          'Choose "Allow all the time" for Location so the responder overlay can continue sending updates while the app is in the background.'
        );
        return false;
      }

      backgroundPermission = await Location.requestBackgroundPermissionsAsync();
      if (backgroundPermission.status === 'granted') {
        locationPermissionPromptShownRef.current = false;
        return true;
      }

      promptForBackgroundLocationSettings(
        'The floating responder bubble needs Location access set to "Allow all the time" so updates continue after you leave the app.'
      );
      return false;
    },
    [promptForBackgroundLocationSettings]
  );

  const syncOverlayStateForAppState = useCallback(
    async (nextState: string) => {
      if (Platform.OS !== 'android') {
        return;
      }

      if (!isLoggedIn) {
        await stopOverlayLocationService();
        return;
      }

      const hasRequiredLocationPermission = await ensureAndroidBackgroundLocationPermission(
        nextState === 'active'
      );
      if (!hasRequiredLocationPermission) {
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
    [consumeOverlayNavigationIfAny, ensureAndroidBackgroundLocationPermission, isLoggedIn]
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
      const isLiveChatVisible = currentState.showChat && chatScreenModeRef.current === 'live';

      if (notificationType === 'new_message' && Number.isFinite(reportId) && reportId > 0) {
        const activeReportId = Number(currentState.activeIncident?.id ?? 0);
        if (isLiveChatVisible || activeReportId === reportId) {
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
    chatScreenModeRef.current = chatScreenMode;
  }, [chatScreenMode]);

  useEffect(() => {
    refreshIncomingIncidentRef.current = refreshIncomingIncident;
  }, [refreshIncomingIncident]);

  useEffect(() => {
    openReportChatFromOverlayRef.current = openReportChatFromOverlay;
  }, [openReportChatFromOverlay]);

  useEffect(() => {
    if (!isNavigationReady) {
      return;
    }

    const currentRoute = navigationRef.getCurrentRoute()?.name;
    if (state.showChat && currentRoute !== 'Chat') {
      navigate('Chat');
      return;
    }

    if (state.showHistory && currentRoute !== 'History') {
      navigate('History');
    }
  }, [isNavigationReady, state.showChat, state.showHistory]);

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
  }, [resolveUserName]);

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

  const handleOpenChat = useCallback(async () => {
    const reportId = state.activeIncident?.id ?? '';
    const reportIdNum = Number(reportId);
    if (!Number.isFinite(reportIdNum) || reportIdNum <= 0) {
      Alert.alert('No active report', 'Accept a dispatch first before opening live chat.');
      return;
    }

    try {
      const messages = await fetchChatMessages(String(reportIdNum));
      setChatScreenMode('live');
      setState((prev) => ({
        ...prev,
        showChat: true,
        chatMessages: messages,
        activeChatTab: prev.activeChatTab ?? 'citizen',
      }));
      navigate('Chat');
    } catch (error) {
      console.warn('Failed to open live chat:', error);
      Alert.alert('Error', 'Failed to load chat messages. Please try again.');
    }
  }, [state.activeIncident?.id]);

  const handleCloseChat = useCallback(() => {
    setState((prev) => ({
      ...prev,
      showChat: false,
    }));
  }, []);

  const handleOpenHistory = useCallback(() => {
    setState((prev) => ({
      ...prev,
      showHistory: true,
    }));
    navigate('History');
  }, []);

  const handleCloseHistory = useCallback(() => {
    setState((prev) => ({
      ...prev,
      showHistory: false,
    }));
  }, []);

  const handleOpenReport = useCallback(() => {
    if (!state.activeIncident?.id) {
      Alert.alert('No active report', 'There is no active incident report to open right now.');
      return;
    }

    navigate('Report');
  }, [state.activeIncident?.id]);

  const handleOpenHistoryChat = useCallback(async (incidentId: string) => {
    try {
      const messages = await fetchChatMessages(incidentId);
      setHistoryChatMessages(messages);
      setHistoryChatTitle(`Incident #${incidentId}`);
      setChatScreenMode('history');
      setState((prev) => ({
        ...prev,
        showChat: true,
      }));
      navigate('Chat');
    } catch (error) {
      console.warn('Failed to open history chat:', error);
      Alert.alert('Error', 'Failed to load history chat. Please try again.');
    }
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
    setIsNavigationReady(false);
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
      const conversationTarget = state.activeChatTab === 'dispatcher' ? 'dispatcher' : 'citizen';
      const receiverId =
        conversationTarget === 'dispatcher'
          ? state.activeIncident?.dispatcher_id ?? undefined
          : state.activeIncident?.citizen_id ?? undefined;
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
              sender_id: currentUserId ?? undefined,
              receiver_id: receiverId ?? undefined,
              peer_id: receiverId ?? undefined,
              sender_is_citizen: false,
              sender_is_responder: true,
              peer_is_citizen: conversationTarget === 'citizen',
              peer_is_responder: false,
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
              conversation_target: conversationTarget,
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
                sender_id: currentUserId ?? undefined,
                receiver_id: receiverId ?? undefined,
                peer_id: receiverId ?? undefined,
                sender_is_citizen: false,
                sender_is_responder: true,
                peer_is_citizen: conversationTarget === 'citizen',
                peer_is_responder: false,
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
            conversation_target: conversationTarget,
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
    [currentUserId, state.activeChatTab, state.activeIncident]
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
      const peerId = msg.peer_id ?? (senderId === selfId ? receiverId : senderId);
      const peerIsCitizen =
        typeof msg.peer_is_citizen === 'boolean'
          ? msg.peer_is_citizen
          : senderId === selfId
            ? msg.receiver_is_citizen
            : msg.sender_is_citizen;

      if (activeTab === 'dispatcher') {
        if (dispatcherId) {
          return peerId === dispatcherId;
        }

        return typeof peerIsCitizen === 'boolean' ? peerIsCitizen === false : true;
      }

      if (citizenId) {
        return peerId === citizenId;
      }

      return typeof peerIsCitizen === 'boolean' ? peerIsCitizen === true : true;
    });
  }, [currentUserId, state.activeChatTab, state.activeIncident?.citizen_id, state.activeIncident?.dispatcher_id, state.activeIncident?.receiver_id, state.chatMessages]);

  const chatMessagesForScreen =
    chatScreenMode === 'history' ? historyChatMessages : filteredChatMessages;
  const chatScreenTitle =
    chatScreenMode === 'history'
      ? historyChatTitle
      : state.activeChatTab === 'dispatcher'
        ? 'Dispatcher Chat'
        : 'Citizen Chat';
  const chatScreenSubtitle =
    chatScreenMode === 'history'
      ? 'Historical conversation'
      : state.activeChatTab === 'dispatcher'
        ? 'Dispatcher conversation'
        : 'Citizen conversation';

  const theme = {
    background: isDarkMode ? '#0F172A' : '#F8FAFC',
    surface: isDarkMode ? '#1E293B' : '#FFFFFF',
    surfaceAlt: isDarkMode ? '#334155' : '#E2E8F0',
    text: isDarkMode ? '#F8FAFC' : '#0F172A',
    textSecondary: isDarkMode ? '#94A3B8' : '#475569',
  };
  const isStatusCompleted = state.currentStatus === 'Completed';
  const mapShouldBeFullscreen = state.isMapFullscreen;
  const portraitMapHeight = Math.min(Math.max(screenHeight * 0.34, 280), 360);

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

  const formatIncidentTime = (timestamp?: string | null) => {
    if (!timestamp) {
      return 'Monitoring';
    }

    try {
      return new Date(timestamp.replace(' ', 'T')).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return 'Monitoring';
    }
  };

  const renderSectionHeader = (eyebrow: string, title: string, subtitle: string) => (
    <View style={styles.sectionHeaderBlock}>
      <Text style={[styles.sectionEyebrow, { color: DEFAULT_CONFIG.primary_color }]}>{eyebrow}</Text>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>{title}</Text>
      <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>{subtitle}</Text>
    </View>
  );

  const renderHeroMetric = (label: string, value: string) => (
    <View
      style={[
        styles.heroMetricCard,
        { backgroundColor: theme.background, borderColor: theme.surfaceAlt },
      ]}>
      <Text style={[styles.heroMetricLabel, { color: theme.textSecondary }]}>{label}</Text>
      <Text style={[styles.heroMetricValue, { color: theme.text }]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );

  const renderHomeScreen = () => {
    if (state.isMapFullscreen) {
      return (
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
        </View>
      );
    }

    return (
      <>
        <Background />
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
          <StatusBar />
          {renderHeader()}

          <ScrollView
            ref={scrollViewRef}
            style={styles.mainContent}
            contentContainerStyle={[
              styles.mainContentContainer,
              { paddingBottom: Math.max(insets.bottom, 16) + 24 },
            ]}
            showsVerticalScrollIndicator={false}
            scrollEnabled={!isMapInteracting}>
            <View
              style={[
                styles.heroCard,
                { backgroundColor: theme.surface, borderColor: theme.surfaceAlt },
              ]}>
              <View style={styles.heroHeaderBlock}>
                <View style={styles.heroCopy}>
                  <Text style={[styles.heroEyebrow, { color: DEFAULT_CONFIG.primary_color }]}>
                    {state.activeIncident ? 'Live Response' : 'Responder Standby'}
                  </Text>
                  <Text style={[styles.heroTitle, { color: theme.text }]}>
                    {state.activeIncident ? state.activeIncident.type : 'Waiting for incoming reports'}
                  </Text>
                  <Text style={[styles.heroSubtitle, { color: theme.textSecondary }]}>
                    {state.activeIncident
                      ? state.activeIncident.location || 'Location details are not available.'
                      : 'Your map, location tracking, and history tools stay ready while no dispatch is assigned.'}
                  </Text>
                </View>

                <View
                  style={[
                    styles.heroStatusPill,
                    {
                      backgroundColor: state.activeIncident
                        ? STATUS_COLORS[state.currentStatus] || STATUS_COLORS.Pending
                        : theme.surfaceAlt,
                    },
                  ]}>
                  <Text
                    style={[
                      styles.heroStatusPillText,
                      !state.activeIncident && { color: theme.text },
                    ]}>
                    {state.activeIncident ? state.currentStatus : 'Available'}
                  </Text>
                </View>
              </View>

              <View style={styles.heroMetaRow}>
                <View
                  style={[
                    styles.heroMetaChip,
                    { backgroundColor: theme.background, borderColor: theme.surfaceAlt },
                  ]}>
                  <Icon name="document" size={14} color={DEFAULT_CONFIG.primary_color} />
                  <Text style={[styles.heroMetaText, { color: theme.text }]}>
                    {state.activeIncident ? `Report #${state.activeIncident.id}` : 'Standby Mode'}
                  </Text>
                </View>

                <View
                  style={[
                    styles.heroMetaChip,
                    { backgroundColor: theme.background, borderColor: theme.surfaceAlt },
                  ]}>
                  <Icon name="clock" size={14} color={DEFAULT_CONFIG.primary_color} />
                  <Text style={[styles.heroMetaText, { color: theme.text }]}>
                    {state.activeIncident
                      ? formatIncidentTime(state.activeIncident.timeReported)
                      : 'Live map ready'}
                  </Text>
                </View>
              </View>

              <Map
                isDarkMode={isDarkMode}
                isFullscreen={mapShouldBeFullscreen}
                incident={state.activeIncident}
                onToggleFullscreen={isStatusCompleted ? () => {} : handleToggleMapFullscreen}
                onRestoreSize={handleRestoreMapSize}
                onMapPress={() => setIsMapInteracting(true)}
                onMapRelease={() => setIsMapInteracting(false)}
                showFullscreenToggle={!isStatusCompleted}
                mapHeight={portraitMapHeight}
                containerStyle={styles.heroMap}
              />

              <View style={styles.heroMetricsRow}>
                {renderHeroMetric(
                  'Status',
                  state.activeIncident ? state.currentStatus : 'Available'
                )}
                {renderHeroMetric('Responder', userName)}
                {renderHeroMetric(
                  'Last Update',
                  state.activeIncident
                    ? formatIncidentTime(state.activeIncident.timeReported)
                    : 'Monitoring'
                )}
              </View>
            </View>

            {state.activeIncident ? (
              <>
                {state.currentStatus !== 'Completed' && (
                  <>
                    {renderSectionHeader(
                      'Fast Access',
                      'Quick Actions',
                      'Open the tools you need first while actively responding.'
                    )}
                    <QuickAccess
                      onOpenChat={handleOpenChat}
                      onOpenHistory={handleOpenHistory}
                      onOpenReport={handleOpenReport}
                      onOpenStatus={handleScrollToStatus}
                      currentStatus={state.currentStatus}
                      isDarkMode={isDarkMode}
                      onUpdateStatus={handleUpdateStatus}
                    />
                  </>
                )}

                {renderSectionHeader(
                  'Dispatch Summary',
                  'Incident Details',
                  'Review the assigned report, timeline, and responder reference info.'
                )}
                <IncidentDetails
                  incident={state.activeIncident}
                  responderName={DEFAULT_CONFIG.responder_name}
                  isDarkMode={isDarkMode}
                />

                {renderSectionHeader(
                  'Progress',
                  'Status Timeline',
                  'Update the incident as the team moves from dispatch to completion.'
                )}
                <View
                  onLayout={(event) => {
                    statusTrackerYRef.current = event.nativeEvent.layout.y;
                  }}>
                  <StatusTracker
                    incidentId={state.activeIncident.id}
                    onUpdateStatus={handleUpdateStatus}
                    isDarkMode={isDarkMode}
                    onOpenReportForm={handleOpenReport}
                  />
                </View>

                {renderSectionHeader(
                  'Communication',
                  'Team Actions',
                  'Jump into report chat or open previously handled incident history.'
                )}
                <ActionBar
                  onOpenChat={handleOpenChat}
                  onOpenHistory={handleOpenHistory}
                  onOpenReport={handleOpenReport}
                />
              </>
            ) : (
              <>
                {renderSectionHeader(
                  'Standby Queue',
                  'No Active Report',
                  'Stay ready while the system continues monitoring for new incidents.'
                )}
                <View
                  style={[
                    styles.emptyStateCard,
                    { backgroundColor: theme.surface, borderColor: theme.surfaceAlt },
                  ]}>
                  <View
                    style={[
                      styles.emptyStateIconWrap,
                      { backgroundColor: theme.background, borderColor: theme.surfaceAlt },
                    ]}>
                    <Icon name="history" size={22} color={DEFAULT_CONFIG.primary_color} />
                  </View>
                  <Text style={[styles.emptyStateTitle, { color: theme.text }]}>
                    No active report assigned
                  </Text>
                  <Text style={[styles.emptyStateBody, { color: theme.textSecondary }]}>
                    Keep the live map visible, confirm your location is updating, and use history to
                    review previous responses while waiting for the next dispatch.
                  </Text>
                  <TouchableOpacity
                    style={[
                      styles.emptyStateButton,
                      { backgroundColor: DEFAULT_CONFIG.primary_color },
                    ]}
                    onPress={handleOpenHistory}>
                    <Icon name="history" size={18} color="#fff" />
                    <Text style={styles.emptyStateButtonText}>Open History</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </>
    );
  };

  return (
    <ThemeProvider>
      <NavigationContainer ref={navigationRef} onReady={() => setIsNavigationReady(true)}>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Home">{() => renderHomeScreen()}</Stack.Screen>
          <Stack.Screen
            name="Chat"
            listeners={{
              focus: () => {
                setState((prev) => ({ ...prev, showChat: true }));
              },
              blur: () => {
                handleCloseChat();
                if (chatScreenModeRef.current === 'history') {
                  setChatScreenMode('live');
                  setHistoryChatMessages([]);
                  setHistoryChatTitle('Incident Chat');
                }
              },
            }}>
            {({ navigation }) => (
              <ChatScreen
                messages={chatMessagesForScreen}
                onBack={() => navigation.goBack()}
                onSendMessage={handleSendMessage}
                isDarkMode={isDarkMode}
                readOnly={chatScreenMode === 'history'}
                chatTabs={
                  chatScreenMode === 'live'
                    ? [
                        { key: 'dispatcher', label: 'Dispatcher' },
                        { key: 'citizen', label: 'Citizen' },
                      ]
                    : undefined
                }
                activeChatTab={chatScreenMode === 'live' ? state.activeChatTab ?? 'citizen' : undefined}
                onChangeChatTab={chatScreenMode === 'live' ? handleChangeChatTab : undefined}
                title={chatScreenTitle}
                subtitle={chatScreenSubtitle}
              />
            )}
          </Stack.Screen>
          <Stack.Screen
            name="History"
            listeners={{
              focus: () => {
                setState((prev) => ({ ...prev, showHistory: true }));
              },
              blur: handleCloseHistory,
            }}>
            {({ navigation }) => (
              <HistoryScreen
                onBack={() => navigation.goBack()}
                onOpenChat={handleOpenHistoryChat}
                isDarkMode={isDarkMode}
              />
            )}
          </Stack.Screen>
          <Stack.Screen name="Report">
            {({ navigation }) => (
              <ReportScreen
                incidentId={state.activeIncident?.id}
                isDarkMode={isDarkMode}
                onBack={() => navigation.goBack()}
              />
            )}
          </Stack.Screen>
        </Stack.Navigator>
      </NavigationContainer>

      {incomingIncident !== null && (
        <IncomingModal
          visible={state.showIncomingModal}
          incident={incomingIncident}
          onAccept={handleAcceptIncident}
          onDismiss={handleDismissIncident}
        />
      )}

      {renderLogoutModal()}
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
  heroCard: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
    gap: 14,
    shadowColor: '#020617',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  heroHeaderBlock: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  heroCopy: {
    flex: 1,
    gap: 4,
  },
  heroEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 28,
  },
  heroSubtitle: {
    fontSize: 13,
    lineHeight: 19,
  },
  heroStatusPill: {
    minWidth: 88,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroStatusPillText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  heroMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  heroMetaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
  },
  heroMetaText: {
    fontSize: 12,
    fontWeight: '600',
  },
  heroMap: {
    borderRadius: 18,
  },
  heroMetricsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  heroMetricCard: {
    flex: 1,
    minHeight: 78,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    justifyContent: 'space-between',
  },
  heroMetricLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  heroMetricValue: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 18,
  },
  sectionHeaderBlock: {
    gap: 2,
    marginTop: 2,
  },
  sectionEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  sectionSubtitle: {
    fontSize: 13,
    lineHeight: 18,
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
  emptyStateCard: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 22,
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  emptyStateIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  emptyStateBody: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  emptyStateButton: {
    marginTop: 4,
    minWidth: 180,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyStateButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
});
