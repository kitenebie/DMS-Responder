import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeModules, Platform } from 'react-native';
import { ip } from '../lib/domain';

type OverlayStatus = 'started' | 'permission_missing' | 'unavailable' | 'error';

type OverlayStartPayload = {
  baseUrl: string;
  token: string;
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

const readOverlayConfig = async (): Promise<{ token: string }> => {
  try {
    const storedUser = await AsyncStorage.getItem('user');
    // Also check the standalone 'token' key used by axios interceptor
    const standaloneToken = await AsyncStorage.getItem('token');

    if (!storedUser) {
      return { token: '' };
    }

    const parsed = JSON.parse(storedUser);
    const token =
      parsed?.token ??
      standaloneToken ??
      parsed?.access_token ??
      parsed?.user?.token ??
      parsed?.user?.access_token ??
      '';

    return { token };
  } catch (error) {
    console.warn('Unable to read overlay auth config:', error);
    return { token: '' };
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
    if (!config.token) {
      return 'error';
    }

    console.log('[OverlayLocation] Starting authenticated location service.');

    await overlayModule!.startOverlay({
      baseUrl: ip,
      token: config.token,
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
