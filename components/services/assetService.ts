// services/assetService.ts
import * as FileSystem from 'expo-file-system';
import { Asset } from 'expo-asset';

// services/locationService.ts
import * as Location from 'expo-location';

interface AssetCacheEntry {
  content: string;
  timestamp: number;
  size: number;
}

class AssetService {
  private static instance: AssetService;
  private loadedAssets = new Map<string, AssetCacheEntry>();
  private readonly MAX_CACHE_SIZE = 10 * 1024 * 1024; // 10MB max cache
  private readonly CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

  static getInstance(): AssetService {
    if (!AssetService.instance) {
      AssetService.instance = new AssetService();
    }
    return AssetService.instance;
  }

  private generateAssetKey(assetPath: any): string {
    try {
      return typeof assetPath === 'string' ? assetPath : JSON.stringify(assetPath);
    } catch {
      return String(assetPath);
    }
  }

  private isValidCacheEntry(entry: AssetCacheEntry): boolean {
    const now = Date.now();
    return now - entry.timestamp < this.CACHE_DURATION;
  }

  private pruneCache(): void {
    const entries = Array.from(this.loadedAssets.entries());
    let totalSize = entries.reduce((sum, [, entry]) => sum + entry.size, 0);

    if (totalSize <= this.MAX_CACHE_SIZE) return;

    // Sort by timestamp (oldest first)
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);

    // Remove oldest entries until we're under the limit
    for (const [key, entry] of entries) {
      if (totalSize <= this.MAX_CACHE_SIZE * 0.8) break; // Remove to 80% of max

      this.loadedAssets.delete(key);
      totalSize -= entry.size;
    }

    console.log(`Pruned asset cache. New size: ${totalSize} bytes`);
  }

  async loadHtmlAsset(assetPath: any): Promise<string> {
    const assetKey = this.generateAssetKey(assetPath);

    // Return cached asset if available and valid
    const cached = this.loadedAssets.get(assetKey);
    if (cached && this.isValidCacheEntry(cached)) {
      console.log(`Asset cache hit for: ${assetKey}`);
      return cached.content;
    }

    try {
      console.log(`Loading asset: ${assetKey}`);

      const asset = Asset.fromModule(assetPath);
      await asset.downloadAsync();

      if (!asset.localUri) {
        throw new Error('Asset local URI is null after download');
      }

      // Check if file exists
      const fileInfo = await FileSystem.getInfoAsync(asset.localUri);
      if (!fileInfo.exists) {
        throw new Error('Asset file does not exist at local URI');
      }

      const htmlContent = await FileSystem.readAsStringAsync(asset.localUri, {
        encoding: 'utf8',
      });

      if (!htmlContent || htmlContent.trim().length === 0) {
        throw new Error('Asset content is empty');
      }

      // Cache the loaded asset
      const cacheEntry: AssetCacheEntry = {
        content: htmlContent,
        timestamp: Date.now(),
        size: new Blob([htmlContent]).size, // Estimate size
      };

      this.loadedAssets.set(assetKey, cacheEntry);

      // Prune cache if necessary
      this.pruneCache();

      console.log(`Asset loaded successfully: ${assetKey} (${cacheEntry.size} bytes)`);
      return htmlContent;
    } catch (error) {
      console.log(`Failed to load HTML asset ${assetKey}:`, error);
      throw new Error(`Failed to load HTML asset: ${error}`);
    }
  }

  // Preload assets
  async preloadAssets(assetPaths: any[]): Promise<void> {
    const loadPromises = assetPaths.map((path) =>
      this.loadHtmlAsset(path).catch((error) => {
        console.warn(`Failed to preload asset ${path}:`, error);
        return null;
      })
    );

    await Promise.allSettled(loadPromises);
  }

  clearCache(): void {
    this.loadedAssets.clear();
    console.log('Asset cache cleared');
  }

  getCacheInfo(): {
    entries: number;
    totalSize: number;
    items: { key: string; size: number; age: number }[];
  } {
    const now = Date.now();
    const items = Array.from(this.loadedAssets.entries()).map(([key, entry]) => ({
      key,
      size: entry.size,
      age: now - entry.timestamp,
    }));

    const totalSize = items.reduce((sum, item) => sum + item.size, 0);

    return {
      entries: this.loadedAssets.size,
      totalSize,
      items,
    };
  }
}

export const assetService = AssetService.getInstance();

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
        console.warn(`Location permission ${status}. Can ask again: ${canAskAgain}`);
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
      console.warn('All location attempts failed:', error);
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
      console.warn(`Location fetch failed with accuracy ${options.accuracy}:`, error);
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
      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 10000, // Update every 10 seconds
          distanceInterval: 50, // Update every 50 meters
        },
        (locationResult) => {
          try {
            const { latitude, longitude, accuracy } = locationResult.coords;

            if (!this.isValidCoordinate(latitude, longitude)) {
              throw new Error(`Invalid coordinates from watch: ${latitude}, ${longitude}`);
            }

            // Update cache
            this.locationState = {
              current: { latitude, longitude },
              lastUpdated: Date.now(),
              accuracy: accuracy ?? undefined,
              permissionStatus: this.locationState.permissionStatus,
            };

            callback({ latitude, longitude });
          } catch (error) {
            console.log('Error processing location update:', error);
            errorCallback?.(error as Error);
          }
        }
      );

      return {
        remove: () => {
          subscription.remove();
          console.log('Location watching stopped');
        },
      };
    } catch (error) {
      console.log('Failed to start watching location:', error);
      errorCallback?.(error as Error);
      return null;
    }
  }

  getLastKnownLocation(): LocationCoords {
    return this.locationState.current;
  }

  getDefaultLocation(): LocationCoords {
    return DEFAULT_LOCATION;
  }

  getLocationState(): LocationState {
    return { ...this.locationState };
  }

  // Check if location services are enabled
  async isLocationServiceEnabled(): Promise<boolean> {
    try {
      return await Location.hasServicesEnabledAsync();
    } catch (error) {
      console.log('Error checking location services:', error);
      return false;
    }
  }

  // Get detailed location info for debugging
  async getLocationInfo(): Promise<{
    servicesEnabled: boolean;
    permission: Location.LocationPermissionResponse | null;
    lastKnown: LocationCoords;
    cacheAge: number;
    accuracy?: number;
  }> {
    const servicesEnabled = await this.isLocationServiceEnabled();
    const now = Date.now();

    return {
      servicesEnabled,
      permission: this.locationState.permissionStatus,
      lastKnown: this.locationState.current,
      cacheAge: now - this.locationState.lastUpdated,
      accuracy: this.locationState.accuracy,
    };
  }

  // Calculate distance between two points (in meters)
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

    return R * c;
  }

  // Check if a location is within a certain radius of current location
  async isWithinRadius(
    target: LocationCoords,
    radiusMeters: number,
    useCurrentLocation = true
  ): Promise<boolean> {
    const current = useCurrentLocation
      ? await this.getCurrentLocation()
      : this.getLastKnownLocation();

    const distance = this.calculateDistance(current, target);
    return distance <= radiusMeters;
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

  // Reset all location data including permissions
  reset(): void {
    this.locationState = {
      current: DEFAULT_LOCATION,
      lastUpdated: 0,
      permissionStatus: null,
    };
    console.log('Location service reset');
  }
}

export const locationService = LocationService.getInstance();
