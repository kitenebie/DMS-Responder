import AsyncStorage from '@react-native-async-storage/async-storage';
import messaging, { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { api } from '../components/lib/axios';

const USER_STORAGE_KEY = 'user';
const CHAT_NOTIFICATION_CHANNEL_ID = 'chat_notifications';
const DEFAULT_NOTIFICATION_CHANNEL_ID = 'high_importance_channel';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

type NotificationCallbacks = {
  onForegroundMessage?: (
    remoteMessage: FirebaseMessagingTypes.RemoteMessage
  ) => void | Promise<void>;
  onNotificationOpened?: (
    remoteMessage: FirebaseMessagingTypes.RemoteMessage
  ) => void | Promise<void>;
};

class FirebaseNotificationService {
  private currentToken: string | null = null;
  private initialNotificationHandled = false;
  private foregroundListenerUnsubscribe: (() => void) | null = null;
  private openedListenerUnsubscribe: (() => void) | null = null;
  private tokenRefreshUnsubscribe: (() => void) | null = null;

  async initialize(callbacks: NotificationCallbacks = {}): Promise<string | null> {
    await this.requestPermissions();
    await this.registerDeviceForRemoteMessages();

    try {
      this.currentToken = await messaging().getToken();
    } catch (error) {
      console.warn('Failed to read FCM token during initialization:', error);
    }

    this.cleanupListeners();

    this.foregroundListenerUnsubscribe = messaging().onMessage(async (remoteMessage) => {
      await this.presentForegroundNotification(remoteMessage);
      await callbacks.onForegroundMessage?.(remoteMessage);
    });

    this.openedListenerUnsubscribe = messaging().onNotificationOpenedApp((remoteMessage) => {
      if (remoteMessage) {
        void callbacks.onNotificationOpened?.(remoteMessage);
      }
    });

    this.tokenRefreshUnsubscribe = messaging().onTokenRefresh((token) => {
      this.currentToken = token;
      void this.syncTokenForStoredUser(token);
    });

    if (!this.initialNotificationHandled) {
      const initialNotification = await messaging().getInitialNotification();
      if (initialNotification) {
        await callbacks.onNotificationOpened?.(initialNotification);
      }
      this.initialNotificationHandled = true;
    }

    return this.currentToken;
  }

  async getToken(): Promise<string | null> {
    if (this.currentToken) {
      return this.currentToken;
    }

    await this.registerDeviceForRemoteMessages();

    try {
      this.currentToken = await messaging().getToken();
      return this.currentToken;
    } catch (error) {
      console.warn('Failed to get FCM token:', error);
      return null;
    }
  }

  async syncCurrentToken(email?: string | null): Promise<boolean> {
    const token = await this.getToken();
    return this.syncToken(email, token);
  }

  async syncToken(email?: string | null, token?: string | null): Promise<boolean> {
    const resolvedToken = typeof token === 'string' ? token.trim() : '';
    const resolvedEmail = (email ?? (await this.getStoredUserEmail()))?.trim() ?? '';

    if (!resolvedEmail || !resolvedToken) {
      return false;
    }

    try {
      await api.post('/update/fcm', {
        email: resolvedEmail,
        fcm_token: resolvedToken,
      });

      await this.updateStoredUserToken(resolvedToken);
      return true;
    } catch (error) {
      console.warn('Failed to sync FCM token to server:', error);
      return false;
    }
  }

  cleanup(): void {
    this.cleanupListeners();
  }

  private cleanupListeners(): void {
    this.foregroundListenerUnsubscribe?.();
    this.openedListenerUnsubscribe?.();
    this.tokenRefreshUnsubscribe?.();
    this.foregroundListenerUnsubscribe = null;
    this.openedListenerUnsubscribe = null;
    this.tokenRefreshUnsubscribe = null;
  }

  private async requestPermissions(): Promise<void> {
    try {
      const permissions = await Notifications.getPermissionsAsync();
      if (!permissions.granted && permissions.canAskAgain !== false) {
        await Notifications.requestPermissionsAsync();
      }
    } catch (error) {
      console.warn('Notification permission request failed:', error);
    }

    try {
      await messaging().requestPermission();
    } catch (error) {
      console.warn('Firebase messaging permission request failed:', error);
    }
  }

  private async registerDeviceForRemoteMessages(): Promise<void> {
    try {
      await messaging().registerDeviceForRemoteMessages();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.toLowerCase().includes('already')) {
        console.warn('Failed to register device for remote messages:', error);
      }
    }
  }

  private async syncTokenForStoredUser(token: string): Promise<void> {
    const email = await this.getStoredUserEmail();
    if (!email) {
      return;
    }

    await this.syncToken(email, token);
  }

  private async getStoredUserEmail(): Promise<string | null> {
    try {
      const userData = await AsyncStorage.getItem(USER_STORAGE_KEY);
      if (!userData) {
        return null;
      }

      const parsedUser = JSON.parse(userData);
      return parsedUser?.user?.email ?? null;
    } catch (error) {
      console.warn('Failed to read stored user for FCM sync:', error);
      return null;
    }
  }

  private async updateStoredUserToken(token: string): Promise<void> {
    try {
      const userData = await AsyncStorage.getItem(USER_STORAGE_KEY);
      if (!userData) {
        return;
      }

      const parsedUser = JSON.parse(userData);
      if (!parsedUser?.user) {
        return;
      }

      parsedUser.user = {
        ...parsedUser.user,
        FCM: token,
      };

      await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(parsedUser));
    } catch (error) {
      console.warn('Failed to persist synced FCM token locally:', error);
    }
  }

  private resolveChannelId(remoteMessage: FirebaseMessagingTypes.RemoteMessage): string {
    const requestedChannelId =
      remoteMessage.data?.android_channel_id ??
      remoteMessage.notification?.android?.channelId;

    if (requestedChannelId === CHAT_NOTIFICATION_CHANNEL_ID) {
      return CHAT_NOTIFICATION_CHANNEL_ID;
    }

    return DEFAULT_NOTIFICATION_CHANNEL_ID;
  }

  private async presentForegroundNotification(
    remoteMessage: FirebaseMessagingTypes.RemoteMessage
  ): Promise<void> {
    const rawTitle = remoteMessage.notification?.title ?? remoteMessage.data?.notification_name;
    const rawBody = remoteMessage.notification?.body ?? remoteMessage.data?.body;
    const title = typeof rawTitle === 'string' && rawTitle.trim() ? rawTitle : 'Responder Notification';
    const body = typeof rawBody === 'string' ? rawBody : '';

    if (!title && !body) {
      return;
    }

    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: remoteMessage.data,
          sound: 'default',
          priority: Notifications.AndroidNotificationPriority.MAX,
        },
        trigger:
          Platform.OS === 'android'
            ? { channelId: this.resolveChannelId(remoteMessage) }
            : null,
      });
    } catch (error) {
      console.warn('Failed to display foreground notification:', error);
    }
  }
}

export default new FirebaseNotificationService();
