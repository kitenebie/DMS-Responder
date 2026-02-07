// services/locationService.ts
import axios, { AxiosInstance } from 'axios';
import * as Location from 'expo-location';

export interface LocationCoords {
  latitude: number;
  longitude: number;
}

interface LocationState {
  current: LocationCoords;
  lastUpdated: number;
  accuracy?: number;
  permissionStatus: Location.LocationPermissionResponse | null;
}

// Default location - Irosin, Sorsogon, Philippines
const DEFAULT_LOCATION: LocationCoords = {
  latitude: 12.706220102613308,
  longitude: 124.02982096568188,
};

const LOCATION_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const HIGH_ACCURACY_TIMEOUT = 15000; // 15 seconds
const LOW_ACCURACY_TIMEOUT = 10000; // 10 seconds

class LocationService {
  private static instance: LocationService;
  private locationState: LocationState = {
    current: DEFAULT_LOCATION,
    lastUpdated: 0,
    permissionStatus: null,
  };
  private watchSubscription: Location.LocationSubscription | null = null;
  private locationInterval: NodeJS.Timeout | null = null;
  private locationApi: AxiosInstance | null = null;

  static getInstance(): LocationService {
    if (!LocationService.instance) {
      LocationService.instance = new LocationService();
    }
    return LocationService.instance;
  }

  private isLocationCacheValid(): boolean {
    const now = Date.now();
    return now - this.locationState.lastUpdated < LOCATION_CACHE_DURATION;
  }

  private isValidCoordinate(lat: number, lng: number): boolean {
    return (
      typeof lat === 'number' &&
      typeof lng === 'number' &&
      lat >= -90 &&
      lat <= 90 &&
      lng >= -180 &&
      lng <= 180 &&
      !isNaN(lat) &&
      !isNaN(lng)
    );
  }

  async requestPermission(askAgain = true): Promise<boolean> {
    try {
      // Check current permission status first
      const currentStatus = await Location.getForegroundPermissionsAsync();

      if (currentStatus.status === Location.PermissionStatus.GRANTED) {
        this.locationState.permissionStatus = currentStatus;
        return true;
      }

      if (!askAgain && currentStatus.status === Location.PermissionStatus.DENIED) {
        console.log('Location permission previously denied, not asking again');
        return false;
      }

      // Request permission
      const { status, canAskAgain } = await Location.requestForegroundPermissionsAsync();
      this.locationState.permissionStatus = {
        status,
        canAskAgain,
      } as Location.LocationPermissionResponse;

      const granted = status === Location.PermissionStatus.GRANTED;

      if (!granted) {
        console.log(`Location permission ${status}. Can ask again: ${canAskAgain}`);
      }

      return granted;
    } catch (error) {
      console.log('Error requesting location permission:', error);
      return false;
    }
  }

  async getCurrentLocation(forceRefresh = false): Promise<LocationCoords> {
    // Return cached location if valid and not forcing refresh
    if (!forceRefresh && this.isLocationCacheValid()) {
      console.log('Returning cached location');
      return this.locationState.current;
    }

    // Check/request permission
    const hasPermission = await this.requestPermission();
    if (!hasPermission) {
      console.log('No location permission, returning default location');
      return DEFAULT_LOCATION;
    }

    try {
      // Try high accuracy first
      const location = await this.attemptLocationFetch({
        accuracy: Location.Accuracy.Balanced,
      });

      if (location) {
        return location;
      }

      // Fallback to lower accuracy
      console.log('High accuracy failed, trying lower accuracy');
      const fallbackLocation = await this.attemptLocationFetch({
        accuracy: Location.Accuracy.Low,
      });

      return fallbackLocation || DEFAULT_LOCATION;
    } catch (error) {
      console.log('All location attempts failed:', error);
      return DEFAULT_LOCATION;
    }
  }

  private async attemptLocationFetch(
    options: Location.LocationOptions
  ): Promise<LocationCoords | null> {
    try {
      console.log(`Attempting location fetch with accuracy: ${options.accuracy}`);

      const locationResult = await Location.getCurrentPositionAsync(options);

      const { latitude, longitude, accuracy } = locationResult.coords;

      // Validate coordinates
      if (!this.isValidCoordinate(latitude, longitude)) {
        throw new Error(`Invalid coordinates: ${latitude}, ${longitude}`);
      }

      // Update cache
      this.locationState = {
        current: { latitude, longitude },
        lastUpdated: Date.now(),
        accuracy: accuracy ?? undefined,
        permissionStatus: this.locationState.permissionStatus,
      };

      console.log(`Location updated: ${latitude}, ${longitude} (accuracy: ${accuracy}m)`);
      return { latitude, longitude };
    } catch (error) {
      console.log(`Location fetch failed with accuracy ${options.accuracy}:`, error);
      return null;
    }
  }

  // Watch position with callback
  async watchPosition(
    callback: (location: LocationCoords) => void,
    errorCallback?: (error: Error) => void
  ): Promise<{ remove: () => void } | null> {
    const hasPermission = await this.requestPermission();
    if (!hasPermission) {
      const error = new Error('Location permission not granted');
      errorCallback?.(error);
      return null;
    }

    try {
      // Stop any existing watch
      await this.stopWatching();

      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 10000, // Update every 10 seconds
          distanceInterval: 10, // Or when moved 10 meters
        },
        (location) => {
          const { latitude, longitude, accuracy } = location.coords;

          // Validate coordinates
          if (!this.isValidCoordinate(latitude, longitude)) {
            console.log('Invalid coordinates received from watch:', latitude, longitude);
            return;
          }

          // Update cached location
          this.locationState = {
            current: { latitude, longitude },
            lastUpdated: Date.now(),
            accuracy: accuracy ?? undefined,
            permissionStatus: this.locationState.permissionStatus,
          };

          callback({ latitude, longitude });
        }
      );

      this.watchSubscription = subscription;

      return {
        remove: () => {
          this.stopWatching();
        },
      };
    } catch (error) {
      const watchError = new Error(`Failed to watch position: ${error}`);
      console.log('Watch position error:', watchError);
      errorCallback?.(watchError);
      return null;
    }
  }

  async stopWatching(): Promise<void> {
    if (this.watchSubscription) {
      await this.watchSubscription.remove();
      this.watchSubscription = null;
      console.log('Location watching stopped');
    }
  }

  // Get location with timeout
  async getLocationWithTimeout(timeout = 10000): Promise<LocationCoords> {
    return new Promise(async (resolve) => {
      const timeoutId = setTimeout(() => {
        console.log('Location request timed out, returning cached/default location');
        resolve(this.getLastKnownLocation());
      }, timeout);

      try {
        const location = await this.getCurrentLocation();
        clearTimeout(timeoutId);
        resolve(location);
      } catch (error) {
        clearTimeout(timeoutId);
        console.log('Location request failed:', error);
        resolve(this.getLastKnownLocation());
      }
    });
  }

  getLastKnownLocation(): LocationCoords {
    return this.locationState.current;
  }

  getDefaultLocation(): LocationCoords {
    return DEFAULT_LOCATION;
  }

  // Get location accuracy info
  getLocationAccuracy(): number | undefined {
    return this.locationState.accuracy;
  }

  // Get permission status
  getPermissionStatus(): Location.LocationPermissionResponse | null {
    return this.locationState.permissionStatus;
  }

  // Check if location is cached/fresh
  isLocationFresh(): boolean {
    return this.isLocationCacheValid();
  }

  // Calculate distance between two coordinates in meters
  calculateDistance(from: LocationCoords, to: LocationCoords): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (from.latitude * Math.PI) / 180;
    const φ2 = (to.latitude * Math.PI) / 180;
    const Δφ = ((to.latitude - from.latitude) * Math.PI) / 180;
    const Δλ = ((to.longitude - from.longitude) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  }

  // Check if coordinates are within a certain radius
  isWithinRadius(center: LocationCoords, point: LocationCoords, radiusMeters: number): boolean {
    const distance = this.calculateDistance(center, point);
    return distance <= radiusMeters;
  }

  // Format coordinates for display
  formatCoordinates(coords: LocationCoords, precision = 6): string {
    return `${coords.latitude.toFixed(precision)}°, ${coords.longitude.toFixed(precision)}°`;
  }

  // Get location cache info for debugging
  getCacheInfo(): {
    current: LocationCoords;
    lastUpdated: Date;
    age: number;
    accuracy?: number;
    isValid: boolean;
    permissionStatus: string;
  } {
    return {
      current: this.locationState.current,
      lastUpdated: new Date(this.locationState.lastUpdated),
      age: Date.now() - this.locationState.lastUpdated,
      accuracy: this.locationState.accuracy,
      isValid: this.isLocationCacheValid(),
      permissionStatus: this.locationState.permissionStatus?.status || 'unknown',
    };
  }

  // Clear location cache
  clearCache(): void {
    this.locationState = {
      current: DEFAULT_LOCATION,
      lastUpdated: 0,
      permissionStatus: this.locationState.permissionStatus,
    };
    console.log('Location cache cleared');
  }

  // Health check
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'error';
    details: {
      permission: boolean;
      locationAge: number;
      accuracy?: number;
      canGetLocation: boolean;
      lastError?: string;
    };
  }> {
    try {
      const startTime = Date.now();
      const hasPermission = await this.requestPermission(false);

      if (!hasPermission) {
        return {
          status: 'error',
          details: {
            permission: false,
            locationAge: Date.now() - this.locationState.lastUpdated,
            canGetLocation: false,
            lastError: 'Location permission denied',
          },
        };
      }

      // Try to get fresh location
      try {
        await this.getCurrentLocation(true);
        const responseTime = Date.now() - startTime;

        return {
          status: responseTime < 10000 ? 'healthy' : 'degraded',
          details: {
            permission: true,
            locationAge: Date.now() - this.locationState.lastUpdated,
            accuracy: this.locationState.accuracy,
            canGetLocation: true,
          },
        };
      } catch (locationError) {
        return {
          status: 'degraded',
          details: {
            permission: true,
            locationAge: Date.now() - this.locationState.lastUpdated,
            accuracy: this.locationState.accuracy,
            canGetLocation: false,
            lastError: String(locationError),
          },
        };
      }
    } catch (error) {
      return {
        status: 'error',
        details: {
          permission: false,
          locationAge: Date.now() - this.locationState.lastUpdated,
          canGetLocation: false,
          lastError: String(error),
        },
      };
    }
  }

  // Initialize location API client
  initializeLocationApi(apiInstance: AxiosInstance): void {
    this.locationApi = apiInstance;
  }

  // Start sending location to server every 3 seconds
  async startLocationTracking(): Promise<{ remove: () => void } | null> {
    if (!this.locationApi) {
      console.log('[LocationTracking] Location API not initialized. Call initializeLocationApi first.');
      return null;
    }

    const hasPermission = await this.requestPermission();
    if (!hasPermission) {
      console.log('[LocationTracking] Location permission not granted');
      return null;
    }

    // Stop any existing tracking
    this.stopLocationTracking();

    console.log('[LocationTracking] Starting location tracking (every 3 seconds)...');

    // Send initial location
    try {
      const location = await this.getCurrentLocation();
      await this.sendLocationToServer(location);
      console.log('[LocationTracking] Initial location sent successfully');
    } catch (error) {
      console.log('[LocationTracking] Failed to send initial location:', error);
    }

    // Send location every 3 seconds
    this.locationInterval = setInterval(async () => {
      try {
        const location = await this.getCurrentLocation();
        await this.sendLocationToServer(location);
        console.log(`[LocationTracking] Location sent: ${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`);
      } catch (error) {
        console.log('[LocationTracking] Failed to send location:', error);
      }
    }, 3000);

    return {
      remove: () => {
        this.stopLocationTracking();
      },
    };
  }

  // Stop location tracking
  stopLocationTracking(): void {
    if (this.locationInterval) {
      clearInterval(this.locationInterval);
      this.locationInterval = null;
      console.log('[LocationTracking] Location tracking stopped');
    }
  }

  // Send location to server
  private async sendLocationToServer(location: LocationCoords): Promise<void> {
    if (!this.locationApi) {
      console.log('[LocationTracking] Location API not initialized');
      return;
    }

    try {
      const response = await this.locationApi.post('/responder/location', {
        lat: location.latitude,
        lng: location.longitude,
      });
      console.log(`[LocationTracking] Server response: ${response.status} - ${response.statusText}`);
    } catch (error: any) {
      console.log('[LocationTracking] Server error:', error.response?.data || error.message);
      throw error;
    }
  }

  // Cleanup method to be called on app shutdown
  cleanup(): void {
    this.stopWatching();
    this.stopLocationTracking();
    this.clearCache();
  }
}

export const locationService = LocationService.getInstance();
