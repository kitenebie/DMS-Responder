import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './axios';
import FirebaseNotificationService from '../../services/FirebaseNotificationService';

export const getStoredUser = async () => {
  try {
    const userData = await AsyncStorage.getItem('user');
    return userData ? JSON.parse(userData) : null;
  } catch (error) {
    console.log('Failed to get stored user:', error);
    console.log('Failed to get stored user:', error);
    console.log('Failed to get stored user:', error);
    return null;
  }
};

export const isLoggedIn = async (): Promise<boolean> => {
  const user = await getStoredUser();
  return user !== null;
};

export const getDeviceId = async () => {
  try {
    let deviceId = await AsyncStorage.getItem('device_id');
    if (!deviceId) {
      // Generate a simple UUID-like string
      deviceId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
      await AsyncStorage.setItem('device_id', deviceId);
    }
    return deviceId;
  } catch (error) {
    console.log('Failed to get device id:', error);
    return 'default-device-id';
  }
};

export const login = async (email: string, password: string, rememberMe: boolean = false) => {
  try {
    const deviceId = await getDeviceId();
    let fcmToken: string | null = null;

    try {
      fcmToken = await FirebaseNotificationService.getToken();
    } catch (error) {
      console.log('Failed to get FCM token before login:', error);
    }

    const response = await api.post('/auth/login', {
      email,
      password,
      remember_me: rememberMe,
      device_id: deviceId,
      ...(fcmToken ? { fcm_token: fcmToken } : {}),
    });

    const userData = response.data;

    // Validate response structure
    if (!userData.user) {
      console.error('Invalid response structure:', userData);
      throw new Error('Invalid server response - missing user data');
    }

    // Store user data
    await AsyncStorage.setItem('user', JSON.stringify(userData));
    console.log('User data stored successfully');

    // Store refresh token if provided
    if (userData.refresh_token) {
      await AsyncStorage.setItem('refresh_token', userData.refresh_token);
      console.log('Refresh token stored successfully');
    }

    if (fcmToken) {
      try {
        await FirebaseNotificationService.syncToken(userData.user?.email ?? email, fcmToken);
        userData.user = {
          ...userData.user,
          FCM: fcmToken,
        };
        await AsyncStorage.setItem('user', JSON.stringify(userData));
      } catch (error) {
        console.log('Failed to sync FCM token after login:', error);
      }
    }

    console.log('Login successful');
    return userData;
  } catch (error: any) {
    console.error('Login failed with details:', {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      url: error.config?.url
    });

    // Provide more specific error messages
    if (error.response?.status === 401) {
      const errorCode = error.response.data?.error_code;
      const message = error.response.data?.message || 'Invalid credentials';

      if (errorCode === 'USER_NOT_FOUND') {
        throw new Error('User not found or not authorized as dispatcher');
      } else if (errorCode === 'INVALID_PASSWORD') {
        throw new Error('Incorrect password');
      } else {
        throw new Error(message);
      }
    } else if (error.response?.status === 422) {
      throw new Error('Validation failed: ' + JSON.stringify(error.response.data.errors));
    } else if (error.response?.status === 500) {
      throw new Error('Server error: ' + (error.response.data?.error || 'Internal server error'));
    } else if (error.response?.status >= 400) {
      throw new Error(`HTTP ${error.response.status}: ${error.response.statusText}`);
    } else {
      throw new Error(error.message || 'Network error occurred');
    }
  }
};

export const logout = async () => {
  try {
    const deviceId = await getDeviceId();
    await api.post('/auth/logout', { device_id: deviceId });
  } catch (error) {
    console.log('Server logout failed:', error);
  }

  try {
    await AsyncStorage.removeItem('user');
    await AsyncStorage.removeItem('credentials');
    await AsyncStorage.removeItem('csrf_token');
    await AsyncStorage.removeItem('refresh_token');
    await AsyncStorage.removeItem('device_id');
  } catch (error) {
    console.log('Local logout failed:', error);
  }
};

export const saveCredentials = async (email: string, password: string) => {
  try {
    await AsyncStorage.setItem('credentials', JSON.stringify({ email, password }));
  } catch (error) {
    console.log('Failed to save credentials:', error);
  }
};

export const getCredentials = async () => {
  try {
    const creds = await AsyncStorage.getItem('credentials');

    // creds is already a string, no need to stringify again
    console.log(creds);

    return creds ? JSON.parse(creds) : null;
  } catch (error) {
    console.log('Failed to get credentials:', error);
    return null;
  }
};


export const refreshLogin = async () => {
  try {
    const refreshToken = await AsyncStorage.getItem('refresh_token');
    const deviceId = await getDeviceId();
    const fcmToken = await FirebaseNotificationService.getToken();
    if (!refreshToken) {
      throw new Error('No refresh token');
    }
    const response = await api.post('/auth/refresh', {
      refresh_token: refreshToken,
      device_id: deviceId,
      ...(fcmToken ? { fcm_token: fcmToken } : {}),
    });
    const userData = response.data;
    await AsyncStorage.setItem('user', JSON.stringify(userData));
    if (userData.refresh_token) {
      await AsyncStorage.setItem('refresh_token', userData.refresh_token);
    }
    if (fcmToken) {
      await FirebaseNotificationService.syncToken(userData.user?.email, fcmToken);
    }
    console.log('Refresh login successful');
    return userData;
  } catch (error: any) {
    console.log('Refresh login failed:', error);
    // Clear invalid tokens
    await AsyncStorage.removeItem('refresh_token');
    throw error;
  }
};
