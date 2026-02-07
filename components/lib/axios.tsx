import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ip } from './domain';
import { ReportForm } from '@/types';

const api = axios.create({
  baseURL: ip,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    Accept: 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  },
});

// Request interceptor to add authentication token
api.interceptors.request.use(
  async (config) => {
    try {
      const userData = await AsyncStorage.getItem('user');
      if (userData) {
        const parsedUserData = JSON.parse(userData);
        const token = parsedUserData.token || parsedUserData.access_token;
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      }
    } catch (error) {
      console.log('Error adding auth token to request:', error);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle 401 errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Don't automatically clear data on 401, let the component handle it
    return Promise.reject(error);
  }
);

export { api };

// Submit report form to API
export const submitReportForm = async (reportForm: ReportForm, photoUri?: string | null, incidentId?: string): Promise<boolean> => {
  try {
    const formData = new FormData();
    
    // Add form fields
    formData.append('actions_taken', reportForm.actionsTaken);
    formData.append('time_arrived', reportForm.timeArrived);
    formData.append('time_completed', reportForm.timeCompleted);
    formData.append('additional_notes', reportForm.additionalNotes);
    
    if (incidentId) {
      formData.append('incident_id', incidentId);
    }
    
    // Add photo if available
    if (photoUri) {
      const filename = photoUri.split('/').pop();
      const match = /\.(\w+)$/.exec(filename || '');
      const type = match ? `image/${match[1]}` : 'image/jpeg';
      
      formData.append('photo', {
        uri: photoUri,
        name: filename || 'photo.jpg',
        type,
      } as any);
    }
    
    const response = await api.post('/responder/report/form/submit', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    
    return response.status === 200 || response.status === 201;
  } catch (error: any) {
    console.error('Error submitting report form:', error.response?.data || error.message);
    throw error;
  }
};

// Send location to API
interface LocationPayload {
  lat: number;
  lng: number;
}

export const sendLocation = async (location: LocationPayload): Promise<boolean> => {
  try {
    console.log(`[Location] Sending location to server: lat=${location.lat}, lng=${location.lng}`);
    const response = await api.post('/responder/location', {
      lat: location.lat,
      lng: location.lng,
    });
    
    console.log(`[Location] Location sent successfully! Status: ${response.status}`);
    return response.status === 200 || response.status === 201;
  } catch (error: any) {
    console.error('[Location] Failed to send location:', error.response?.data || error.message);
    throw error;
  }
};
