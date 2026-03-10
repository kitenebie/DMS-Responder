// services/mapService.ts
import { api } from 'components/lib/axios';
import { getStoredUser } from 'components/lib/auth';
import { MapMarker, MapShape, MapShapeType } from 'react-native-leaflet-view';

export interface GeofenceData {
  IrosinBoundery: [number, number][];
}

export interface ReportDetail {
  id: number;
  title: string;
  user_id: number;
  ReportCode: string;
  CitizenName: string;
  gender: string;
  responder_unit_id: string;
  image_path: string;
  icon: string;
  status: string;
  report_type: string;
}

export interface ReportData {
  points: [number, number][];
  reportDetails: ReportDetail[];
}

export interface RouteResponse {
  routes: {
    geometry: {
      coordinates: [number, number][];
    };
    duration?: number;
    distance?: number;
  }[];
}

// Extended MapMarker interface to include report details
export interface ReportMapMarker extends MapMarker {
  reportDetail: ReportDetail;
  coordinates: [number, number];
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  retryCount?: number;
}

interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
}

class MapService {
  private static instance: MapService;
  private cache = new Map<string, CacheEntry<any>>();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  private readonly STALE_CACHE_DURATION = 15 * 60 * 1000; // 15 minutes for stale data
  private readonly DEFAULT_RETRY_CONFIG: RetryConfig = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 10000,
  };

  // Event handlers
  private handleMarkerPress?: (
    report: ReportDetail,
    position: { lat: number; lng: number }
  ) => void;
  private onDataUpdate?: (type: 'reports' | 'geofence', data: any) => void;

  static getInstance(): MapService {
    if (!MapService.instance) {
      MapService.instance = new MapService();
    }
    return MapService.instance;
  }

  private isCacheValid(key: string): boolean {
    const cached = this.cache.get(key);
    if (!cached) return false;
    return Date.now() - cached.timestamp < this.CACHE_DURATION;
  }

  private isCacheStale(key: string): boolean {
    const cached = this.cache.get(key);
    if (!cached) return true;
    return Date.now() - cached.timestamp > this.STALE_CACHE_DURATION;
  }

  private getFromCache<T>(key: string, allowStale = false): T | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    if (this.isCacheValid(key)) {
      return cached.data as T;
    }

    // Return stale data if allowed and not too old
    if (allowStale && !this.isCacheStale(key)) {
      console.log(`Returning stale cache for: ${key}`);
      return cached.data as T;
    }

    return null;
  }

  private setCache<T>(key: string, data: T, retryCount = 0): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      retryCount,
    });
  }

  private async retryWithBackoff<T>(
    operation: () => Promise<T>,
    config: Partial<RetryConfig> = {}
  ): Promise<T> {
    const finalConfig = { ...this.DEFAULT_RETRY_CONFIG, ...config };
    let lastError: Error;

    for (let attempt = 0; attempt <= finalConfig.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        if (attempt === finalConfig.maxRetries) {
          throw lastError;
        }

        const delay = Math.min(finalConfig.baseDelay * Math.pow(2, attempt), finalConfig.maxDelay);

        console.warn(`Attempt ${attempt + 1} failed, retrying in ${delay}ms:`, error);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw lastError!;
  }

  async fetchGeofence(allowStale = false): Promise<MapShape[]> {
    const cacheKey = 'geofence';
    const cached = this.getFromCache<MapShape[]>(cacheKey, allowStale);
    if (cached) return cached;

    return this.retryWithBackoff(
      async () => {
        try {
          const response = await api.get<GeofenceData>('/get-geonfence', {
            timeout: 10000,
          });

          if (!response.data?.IrosinBoundery) {
            throw new Error('Invalid geofence data structure');
          }

          const coords = response.data.IrosinBoundery;

          if (!Array.isArray(coords) || coords.length === 0) {
            throw new Error('Empty or invalid coordinates array');
          }

          const shapes: MapShape[] = [
            {
              id: 'irosin-boundary',
              shapeType: MapShapeType.POLYLINE,
              color: '#ef4444', // red-500
              positions: coords.map(([lng, lat]) => {
                if (typeof lng !== 'number' || typeof lat !== 'number') {
                  throw new Error('Invalid coordinate values');
                }
                return { lat, lng };
              }),
            },
          ];

          this.setCache(cacheKey, shapes);

          // Notify listeners
          if (this.onDataUpdate) {
            this.onDataUpdate('geofence', shapes);
          }

          return shapes;
        } catch (error) {
          console.log('Failed to fetch geofence:', error);
          throw new Error(`Failed to fetch geofence: ${error}`);
        }
      },
      { maxRetries: 2 }
    );
  }

  async fetchReports(allowStale = false): Promise<ReportMapMarker[]> {
    const cacheKey = 'reports';
    const cached = this.getFromCache<ReportMapMarker[]>(cacheKey, allowStale);
    if (cached) return cached;

    return this.retryWithBackoff(
      async () => {
        try {
          const userData = await getStoredUser();
          const unit_id = userData?.user?.unit_id;
          const url = `/responder/report/${unit_id}`;
          console.log('Fetching reports from:', url);
          const response = await api.get<ReportData>(url, {
            timeout: 15000,
          });

          if (!response.data) {
            throw new Error('No data received from server');
          }

          const { points, reportDetails } = response.data;

          if (!Array.isArray(points) || !Array.isArray(reportDetails)) {
            throw new Error('Invalid response data structure');
          }

          if (points.length !== reportDetails.length) {
            console.warn('Mismatch between points and report details length');
          }

          const markers: ReportMapMarker[] = points
            .map((point, idx) => {
              const detail = reportDetails[idx];

              if (!detail) {
                console.warn(`Missing detail for point ${idx}`);
                return null;
              }

              if (!Array.isArray(point) || point.length !== 2) {
                console.warn(`Invalid point format at index ${idx}:`, point);
                return null;
              }

              const [lat, lng] = point;

              if (typeof lat !== 'number' || typeof lng !== 'number') {
                console.warn(`Invalid coordinates at index ${idx}:`, point);
                return null;
              }

              return {
                id: `report-${detail.id}`,
                position: { lat, lng },
                icon: this.createReportIcon(detail.status),
                reportDetail: detail,
                coordinates: point,
                onPress: () => {
                  if (this.handleMarkerPress) {
                    this.handleMarkerPress(detail, { lat, lng });
                  }
                },
              };
            })
            .filter(Boolean) as ReportMapMarker[];

          this.setCache(cacheKey, markers);

          // Notify listeners
          if (this.onDataUpdate) {
            this.onDataUpdate('reports', markers);
          }

          return markers;
        } catch (error) {
          console.log('Failed to fetch reports:', error);
          throw new Error(`Failed to fetch reports: ${error}`);
        }
      },
      { maxRetries: 3 }
    );
  }

  // Event handlers
  setMarkerPressHandler(
    handler: (report: ReportDetail, position: { lat: number; lng: number }) => void
  ): void {
    this.handleMarkerPress = handler;
  }

  setDataUpdateHandler(handler: (type: 'reports' | 'geofence', data: any) => void): void {
    this.onDataUpdate = handler;
  }

  // API methods for accepting/declining reports
  async acceptReport(reportId: number): Promise<void> {
    if (!reportId || typeof reportId !== 'number') {
      throw new Error('Invalid report ID');
    }

    return this.retryWithBackoff(
      async () => {
        try {
          const userData = await getStoredUser();
          const userId = userData?.user?.id;
          if (!userId) {
            throw new Error('User ID not found');
          }

          const response = await api.post(
            `/responder/report/${userId}/${reportId}/accept`,
            {},
            {
              timeout: 10000,
            }
          );

          console.log('Report accepted successfully:', response.data);

          // Clear reports cache to force refresh
          this.invalidateCache('reports');

          return response.data;
        } catch (error) {
          console.log('Failed to accept report:', error);
          throw new Error(`Failed to accept report: ${error}`);
        }
      },
      { maxRetries: 2 }
    );
  }

  async declineReport(reportId: number, reason?: string): Promise<void> {
    if (!reportId || typeof reportId !== 'number') {
      throw new Error('Invalid report ID');
    }

    const declineReason = typeof reason === 'string' ? reason.trim() : '';
    if (!declineReason) {
      throw new Error('Decline reason is required');
    }

    return this.retryWithBackoff(
      async () => {
        try {
          const userData = await getStoredUser();
          const userId = userData?.user?.id;
          if (!userId) {
            throw new Error('User ID not found');
          }

          const payload = { decline_reason: declineReason };
          const response = await api.post(
            `/responder/report/${userId}/${reportId}/decline`,
            payload,
            {
              timeout: 10000,
            }
          );

          console.log('Report declined successfully:', response.data);

          // Clear reports cache to force refresh
          this.invalidateCache('reports');

          return response.data;
        } catch (error) {
          console.log('Failed to decline report:', error);
          throw new Error(`Failed to decline report: ${error}`);
        }
      },
      { maxRetries: 2 }
    );
  }

  // Get report status counts
  async getReportStats(): Promise<{
    pending: number;
    accepted: number;
    declined: number;
    total: number;
  }> {
    try {
      const markers = await this.fetchReports(true); // Allow stale data for stats
      const stats = markers.reduce(
        (acc, marker) => {
          const status = marker.reportDetail.status.toLowerCase();
          acc.total++;

          switch (status) {
            case 'pending':
              acc.pending++;
              break;
            case 'accepted':
              acc.accepted++;
              break;
            case 'declined':
              acc.declined++;
              break;
          }

          return acc;
        },
        { pending: 0, accepted: 0, declined: 0, total: 0 }
      );

      return stats;
    } catch (error) {
      console.log('Failed to get report stats:', error);
      return { pending: 0, accepted: 0, declined: 0, total: 0 };
    }
  }

  async fetchRoute(
    from: { latitude: number; longitude: number },
    to: { lat: number; lng: number }
  ): Promise<MapShape | null> {
    // Validate coordinates
    if (
      !this.isValidCoordinate(from.latitude, from.longitude) ||
      !this.isValidCoordinate(to.lat, to.lng)
    ) {
      throw new Error('Invalid coordinates provided');
    }

    const cacheKey = `route-${from.latitude.toFixed(6)}-${from.longitude.toFixed(6)}-${to.lat.toFixed(6)}-${to.lng.toFixed(6)}`;
    const cached = this.getFromCache<MapShape>(cacheKey);
    if (cached) return cached;

    return this.retryWithBackoff(
      async () => {
        try {
          const url = `https://router.project-osrm.org/route/v1/driving/${from.longitude},${from.latitude};${to.lng},${to.lat}?overview=full&geometries=geojson`;

          const response = await fetch(url, {
            method: 'GET',
            headers: {
              Accept: 'application/json',
            },
          });

          if (!response.ok) {
            throw new Error(`Route request failed: ${response.status} ${response.statusText}`);
          }

          const data: RouteResponse = await response.json();

          if (!data.routes?.length) {
            console.warn('No routes found');
            return null;
          }

          const route = data.routes[0];

          if (!route.geometry?.coordinates?.length) {
            throw new Error('Invalid route geometry');
          }

          const coords = route.geometry.coordinates;

          const shape: MapShape = {
            id: 'user-to-report-path',
            shapeType: MapShapeType.POLYLINE,
            color: '#3b82f6', // blue-500
            positions: coords.map(([lng, lat]) => ({ lat, lng })),
          };

          this.setCache(cacheKey, shape);
          return shape;
        } catch (error) {
          console.log('Failed to fetch route:', error);
          throw new Error(`Failed to fetch route: ${error}`);
        }
      },
      { maxRetries: 1, maxDelay: 5000 }
    ); // Shorter retry for routes
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

  // Cache management
  private invalidateCache(key: string): void {
    this.cache.delete(key);
  }

  clearRoute(): void {
    const keys = Array.from(this.cache.keys());
    keys.forEach((key) => {
      if (key.startsWith('route-')) {
        this.cache.delete(key);
      }
    });
  }

  // Icon creation methods
  private createReportIcon(status: string = 'pending'): string {
    const getStatusColor = (status: string) => {
      switch (status.toLowerCase()) {
        case 'pending':
          return { bg: '#f59e0b', ring: '#f59e0b' }; // amber-500
        case 'accepted':
          return { bg: '#10b981', ring: '#10b981' }; // emerald-500
        case 'declined':
          return { bg: '#ef4444', ring: '#ef4444' }; // red-500
        case 'in_progress':
          return { bg: '#3b82f6', ring: '#3b82f6' }; // blue-500
        case 'completed':
          return { bg: '#8b5cf6', ring: '#8b5cf6' }; // violet-500
        default:
          return { bg: '#f59e0b', ring: '#f59e0b' }; // amber-500
      }
    };

    const colors = getStatusColor(status);

    return `
      <div style="position: relative; height: 16px; width: 16px; background-color: ${colors.bg}; display: flex; padding: 8px; border-radius: 50%; justify-content: center; align-items: center;">
        <div style="position: absolute; display: inline-flex; height: 24px; width: 24px; border-radius: 50%; background-color: ${colors.ring}; opacity: 0.75; animation: ping 1s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
        <div style="position: absolute; display: inline-flex; height: 16px; width: 16px; border-radius: 50%; background-color: ${colors.bg}; opacity: 0.9; animation: ping 1s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
        <div style="position: absolute; display: inline-flex; height: 8px; width: 8px; border-radius: 50%; background-color: ${colors.bg};"></div>
      </div>
      <style>
        @keyframes ping {
          75%, 100% {
            transform: scale(2);
            opacity: 0;
          }
        }
      </style>
    `;
  }

  createUserIcon(): string {
    return `
      <div style="position: relative; display: flex; justify-content: center; align-items: center;">
        <div style="position: absolute; display: inline-flex; height: 32px; width: 32px; border-radius: 50%; background-color: #60a5fa; opacity: 0.75; animation: ping 1s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
        <div style="position: relative; display: inline-flex; height: 16px; width: 16px; border-radius: 50%; background-color: #2563eb;"></div>
      </div>
      <style>
        @keyframes ping {
          75%, 100% {
            transform: scale(2);
            opacity: 0;
          }
        }
      </style>
    `;
  }

  // Force refresh all data
  async refreshAllData(): Promise<{ reports: ReportMapMarker[]; geofence: MapShape[] }> {
    this.clearCache();

    try {
      // Pre-fetch fresh data concurrently
      const [reports, geofence] = await Promise.allSettled([
        this.fetchReports(),
        this.fetchGeofence(),
      ]);

      const result = {
        reports: reports.status === 'fulfilled' ? reports.value : [],
        geofence: geofence.status === 'fulfilled' ? geofence.value : [],
      };

      return result;
    } catch (error) {
      console.log('Failed to refresh data:', error);
      throw error;
    }
  }

  clearCache(): void {
    this.cache.clear();
  }

  // Get cache info for debugging
  getCacheInfo(): {
    keys: string[];
    size: number;
    entries: { key: string; age: number; stale: boolean }[];
  } {
    const now = Date.now();
    const entries = Array.from(this.cache.entries()).map(([key, value]) => ({
      key,
      age: now - value.timestamp,
      stale: now - value.timestamp > this.CACHE_DURATION,
    }));

    return {
      keys: Array.from(this.cache.keys()),
      size: this.cache.size,
      entries,
    };
  }

  // Health check method
  async healthCheck(): Promise<{ status: 'healthy' | 'degraded' | 'unhealthy'; details: any }> {
    try {
      const startTime = Date.now();

      // Test basic connectivity
      const [reportsTest, geofenceTest] = await Promise.allSettled([
        this.fetchReports(true),
        this.fetchGeofence(true),
      ]);

      const responseTime = Date.now() - startTime;

      const reportsHealthy = reportsTest.status === 'fulfilled';
      const geofenceHealthy = geofenceTest.status === 'fulfilled';

      let status: 'healthy' | 'degraded' | 'unhealthy';

      if (reportsHealthy && geofenceHealthy) {
        status = responseTime < 5000 ? 'healthy' : 'degraded';
      } else if (reportsHealthy || geofenceHealthy) {
        status = 'degraded';
      } else {
        status = 'unhealthy';
      }

      return {
        status,
        details: {
          responseTime,
          reports: {
            healthy: reportsHealthy,
            error: reportsTest.status === 'rejected' ? reportsTest.reason : null,
          },
          geofence: {
            healthy: geofenceHealthy,
            error: geofenceTest.status === 'rejected' ? geofenceTest.reason : null,
          },
          cache: this.getCacheInfo(),
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          error: error,
          cache: this.getCacheInfo(),
        },
      };
    }
  }
}

export const mapService = MapService.getInstance();
