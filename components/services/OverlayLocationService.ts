import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeModules, Platform } from 'react-native';
import { ip } from '../lib/domain';

type OverlayStatus = 'started' | 'permission_missing' | 'unavailable' | 'error';

type OverlayStartPayload = {
  baseUrl: string;
  token: string;
  userId: number;
};

type OverlayNativeModule = {
  isOverlayPermissionGranted: () => Promise<boolean>;
  openOverlayPermissionSettings: () => Promise<boolean>;
  startOverlay: (payload: OverlayStartPayload) => Promise<boolean>;
  stopOverlay: () => Promise<boolean>;
  isOverlayRunning: () => Promise<boolean>;
  setOverlayVisible: (visible: boolean) => Promise<boolean>;
  consumePendingNavigation: () => Promise<{ screen: string; reportId: number } | null>;
};

const overlayModule = NativeModules.OverlayLocationModule as OverlayNativeModule | undefined;
const isAndroid = Platform.OS === 'android';

const readOverlayConfig = async (): Promise<{ token: string; userId: number }> => {
  try {
    const storedUser = await AsyncStorage.getItem('user');
    if (!storedUser) {
      return { token: '', userId: 0 };
    }

    const parsed = JSON.parse(storedUser);
    const token =
      parsed?.token ??
      parsed?.access_token ??
      parsed?.user?.token ??
      parsed?.user?.access_token ??
      '';

    const parsedUserId = Number(
      parsed?.user?.unit_id ??
        parsed?.unit_id ??
        parsed?.user?.id ??
        parsed?.id
    );

    return {
      token,
      userId: Number.isFinite(parsedUserId) ? parsedUserId : 0,
    };
  } catch (error) {
    console.warn('Unable to read overlay auth config:', error);
    return { token: '', userId: 0 };
  }
};

export const isOverlayLocationSupported = (): boolean => isAndroid && !!overlayModule;

export const isOverlayPermissionGranted = async (): Promise<boolean> => {
  if (!isOverlayLocationSupported()) {
    return false;
  }

  try {
    return await overlayModule!.isOverlayPermissionGranted();
  } catch (error) {
    console.warn('Unable to check overlay permission:', error);
    return false;
  }
};

export const openOverlayPermissionSettings = async (): Promise<boolean> => {
  if (!isOverlayLocationSupported()) {
    return false;
  }

  try {
    return await overlayModule!.openOverlayPermissionSettings();
  } catch (error) {
    console.warn('Unable to open overlay settings:', error);
    return false;
  }
};

export const startOverlayLocationService = async (): Promise<OverlayStatus> => {
  if (!isOverlayLocationSupported()) {
    return 'unavailable';
  }

  try {
    const granted = await overlayModule!.isOverlayPermissionGranted();
    if (!granted) {
      return 'permission_missing';
    }

    const config = await readOverlayConfig();
    await overlayModule!.startOverlay({
      baseUrl: ip,
      token: config.token,
      userId: config.userId,
    });
    return 'started';
  } catch (error) {
    console.warn('Failed to start overlay location service:', error);
    return 'error';
  }
};

export const stopOverlayLocationService = async (): Promise<boolean> => {
  if (!isOverlayLocationSupported()) {
    return false;
  }

  try {
    return await overlayModule!.stopOverlay();
  } catch (error) {
    console.warn('Failed to stop overlay location service:', error);
    return false;
  }
};

export const isOverlayLocationServiceRunning = async (): Promise<boolean> => {
  if (!isOverlayLocationSupported()) {
    return false;
  }

  try {
    return await overlayModule!.isOverlayRunning();
  } catch (error) {
    console.warn('Failed to query overlay service state:', error);
    return false;
  }
};

export const setOverlayBubbleVisible = async (visible: boolean): Promise<boolean> => {
  if (!isOverlayLocationSupported()) {
    return false;
  }

  try {
    return await overlayModule!.setOverlayVisible(visible);
  } catch (error) {
    console.warn('Failed to set overlay bubble visibility:', error);
    return false;
  }
};

export const consumePendingOverlayNavigation = async (): Promise<{
  screen: string;
  reportId: number;
} | null> => {
  if (!isOverlayLocationSupported()) {
    return null;
  }

  try {
    return await overlayModule!.consumePendingNavigation();
  } catch (error) {
    console.warn('Failed to consume pending overlay navigation:', error);
    return null;
  }
};
