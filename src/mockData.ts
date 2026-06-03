import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../components/lib/axios';
import { ip } from 'lib/Domain';
import { getStoredUser } from '../components/lib/auth';
import {
  Incident,
  HistoricalIncident,
  HistoricalIncidentsPage,
  ChatMessage,
  AppConfig,
  Theme,
  ReportStatus,
  IncidentStatus,
} from './types';

export const HISTORY_PAGE_SIZE = 10;

const parseBooleanFlag = (value: unknown): boolean | undefined => {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    return value === 1 ? true : value === 0 ? false : undefined;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'yes'].includes(normalized)) {
      return true;
    }
    if (['0', 'false', 'no'].includes(normalized)) {
      return false;
    }
  }
  return undefined;
};

const parseOptionalId = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

// Helper function to determine current status from API response
export const getCurrentStatus = (statusData: ReportStatus | null): IncidentStatus => {
  if (!statusData) return 'Pending';

  // Check for completed status
  if (statusData.cleared_at) return 'Cleared';
  if (statusData.completed_at) return 'Completed';

  // Check for arrived status
  if (statusData.arrived_at) return 'Arrived';

  // Check for ongoing status
  if (statusData.ongoing_at) return 'Ongoing';

  // Default to Pending
  return 'Pending';
};

// Fetch report status from API
export const fetchReportStatus = async (reportId?: string): Promise<ReportStatus | null> => {
  try {
    console.log('Fetching report status from /responder/report/status...');
    const response = await api.post(`/responder/report/status`, { reportId });
    console.log('Report status fetched successfully:', response.data);
    return response.data;
  } catch (error: any) {
    console.error('Error fetching report status:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    return null;
  }
};

// Update report status via API
export const updateReportStatus = async (
  payload?: { status?: IncidentStatus; reportId?: string | number }
): Promise<boolean> => {
  try {
    console.log('Updating report status via /responder/report/update/status...');
    const body: Record<string, any> = {};
    if (payload?.status) {
      body.status = payload.status;
    }
    if (payload?.reportId !== undefined && payload?.reportId !== null) {
      const match = String(payload.reportId).match(/\d+/);
      body.report_id = match ? Number(match[0]) : payload.reportId;
    }
    await api.post(`/responder/report/update/status`, body);
    console.log('Report status updated successfully');
    return true;
  } catch (error: any) {
    console.error('Error updating report status:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    return false;
  }
};

// API functions for accept/decline incident
export const acceptIncident = async (userId: string, reportId: string): Promise<boolean> => {
  try {
    await api.post(`/responder/report/${userId}/${reportId}/accept`);
    console.log('Incident accepted successfully');
    return true;
  } catch (error) {
    console.error('Error accepting incident:', error);
    return false;
  }
};

export const declineIncident = async (
  userId: string,
  reportId: string,
  declineReason: string
): Promise<boolean> => {
  try {
    await api.post(`/responder/report/${userId}/${reportId}/decline`, {
      decline_reason: declineReason,
    });
    console.log('Incident declined successfully');
    return true;
  } catch (error) {
    console.error('Error declining incident:', error);
    return false;
  }
};

export const fetchIncomingIncident = async (): Promise<Incident> => {
  try {
    // Get user data from Cache/AsyncStorage to verify
    const parsedUser = await getStoredUser();

    if (parsedUser) {
      console.log('user data stored:', parsedUser.user);

      // Make API call and properly return the transformed data
      const response = await api.get(`/responder/report/${parsedUser.user.unit_id}`);
      const reportDetails = response.data.reportDetails;
      console.log(`incoming report ${JSON.stringify(reportDetails)}`);
      console.log(`Status report ${response.data.is_accepted}`);

      // FIX: get first item from array
      const report = Array.isArray(reportDetails) ? reportDetails[0] : reportDetails;
      const hasValidReport =
        report &&
        (report?.id ||
          report?.title ||
          report?.location ||
          report?.coordinates ||
          report?.description);

      if (!hasValidReport) {
        return {
          id: '0',
          type: null,
          location: null,
          coordinates: null,
          timeReported: null,
          description: null,
          priority: null,
          caller: null,
          callerPhone: null,
          icon: 'warning',
          report_attachment: '',
          isAccepted: false,
          receiver_id: null,
          dispatcher_id: null,
        };
      }

      const coordinates = {
        lat: report?.coordinates?.lat ?? 0,
        lng: report?.coordinates?.lng ?? 0,
      };

      // Return properly transformed incident
      return {
        id: report?.id?.toString() || '0',
        type: report?.title || 'Unknown',
        location: report?.location || 'N/A',

        // FIX: use coordinates directly
        coordinates,

        timeReported: report?.timeReported || new Date().toISOString(),
        description: report?.description || '',
        priority: report?.priority || 'Medium',
        caller: report?.caller || 'Unknown',
        callerPhone: report?.callerPhone || '',
        icon: 'warning',

        report_attachment: report?.image_path ? `${ip}/storage/${report.image_path}` : '',
        isAccepted: response.data.is_accepted || false,
        receiver_id: report?.receiver_id ?? report?.user_id ?? report?.operator_id ?? null,
        dispatcher_id: report?.operator_id ?? report?.dispatcher_id ?? null,
        citizen_id: report?.user_id ?? null,
      };
    }

    // Return default incident if no user data
    return {
      id: 'Unknown',
      type: 'Unknown',
      location: 'Unknown',
      coordinates: { lat: 0, lng: 0 },
      timeReported: new Date().toISOString(),
      description: '',
      priority: '',
      caller: 'Unknown',
      callerPhone: '',
      icon: 'warning',
      report_attachment: '',
      isAccepted: false,
      receiver_id: null,
      dispatcher_id: null,
      citizen_id: null,
    };
  } catch (error) {
    console.log('Error fetching incident:', error);

    return {
      id: 'Unknown',
      type: 'Unknown',
      location: 'Unknown',
      coordinates: { lat: 0, lng: 0 },
      timeReported: new Date().toISOString(),
      description: '',
      priority: '',
      caller: 'Unknown',
      callerPhone: '',
      icon: 'warning',
      report_attachment: '',
      isAccepted: false,
      receiver_id: null,
      dispatcher_id: null,
      citizen_id: null,
    };
  }
};

export const fetchHistoricalIncidents = async (
  params: { limit?: number; offset?: number } = {}
): Promise<HistoricalIncidentsPage> => {
  const limit = Math.min(Math.max(params.limit ?? HISTORY_PAGE_SIZE, 1), HISTORY_PAGE_SIZE);
  const offset = Math.max(params.offset ?? 0, 0);

  try {
    const response = await api.get('/responder/History', {
      params: { limit, offset },
    });

    const payload = response.data;
    const data = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.data)
      ? payload.data
      : [];
    const pagination = !Array.isArray(payload) ? payload?.pagination ?? {} : {};
    const total = Number.isFinite(Number(pagination.total))
      ? Number(pagination.total)
      : offset + data.length;
    const hasMore = typeof pagination.has_more === 'boolean'
      ? pagination.has_more
      : data.length === limit;
    const nextOffset =
      pagination.next_offset !== undefined && pagination.next_offset !== null
        ? Number(pagination.next_offset)
        : hasMore
        ? offset + data.length
        : null;

    const items: HistoricalIncident[] = data.map((item: any) => ({
      id: String(item.id ?? ''),
      type: item.type ?? 'Unknown',
      location: item.location ?? 'Unknown',
      timeReported: item.timeReported ?? new Date().toISOString(),
      status: item.status ?? 'Pending',
      responder: item.responder ?? 'Unknown',
      description: item.description ?? '',
      actions_taken: item.actions_taken ?? null,
      time_completed: item.time_completed ?? null,
      additional_notes: item.additional_notes ?? null,
      photo_path: item.photo_path ? `${ip}/storage/${item.photo_path}` : null,
    }));

    return {
      items,
      total,
      hasMore,
      nextOffset: Number.isFinite(nextOffset) ? nextOffset : null,
    };
  } catch (error: any) {
    console.error('Error fetching historical incidents:', error.response?.data || error.message);
    return {
      items: [],
      total: 0,
      hasMore: false,
      nextOffset: null,
    };
  }
};

export const fetchChatMessages = async (reportId: string): Promise<ChatMessage[]> => {
  try {
    if (!reportId) {
      return [];
    }
    const match = String(reportId).match(/\d+/);
    const reportIdNum = match ? Number(match[0]) : Number(reportId);
    if (!Number.isFinite(reportIdNum) || reportIdNum <= 0) {
      console.warn('Skipping chat fetch: invalid report id', reportId);
      return [];
    }
    const response = await api.post('/responder/ChatMessages', {
      report_id: reportIdNum,
    });
    const data = Array.isArray(response.data) ? response.data : [];

    return data.map((item: any) => {
      const rawImage = item.image ?? null;
      const image =
        rawImage && typeof rawImage === 'string'
          ? rawImage.startsWith('http')
            ? rawImage
            : `${ip}/storage/${rawImage}`
          : null;
      const senderIsCitizen = parseBooleanFlag(item.sender_is_citizen);
      const senderIsResponder = parseBooleanFlag(item.sender_is_responder);
      const receiverIsCitizen = parseBooleanFlag(item.receiver_is_citizen);
      const receiverIsResponder = parseBooleanFlag(item.receiver_is_responder);
      const peerIsCitizen =
        parseBooleanFlag(item.peer_is_citizen) ??
        (Boolean(item.isUser) ? receiverIsCitizen : senderIsCitizen);
      const peerIsResponder =
        parseBooleanFlag(item.peer_is_responder) ??
        (Boolean(item.isUser) ? receiverIsResponder : senderIsResponder);

      return {
        id: Number(item.id ?? 0),
        sender: item.sender ?? 'Dispatch',
        message: item.message ?? '',
        time: item.time ?? (item.timestamp ? new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''),
        isUser: Boolean(item.isUser),
        image,
        timestamp: item.timestamp ?? null,
        sender_id: parseOptionalId(item.sender_id),
        receiver_id: parseOptionalId(item.receiver_id),
        peer_id: parseOptionalId(item.peer_id),
        peer_name: item.peer_name ?? null,
        sender_is_citizen: senderIsCitizen,
        sender_is_responder: senderIsResponder,
        receiver_is_citizen: receiverIsCitizen,
        receiver_is_responder: receiverIsResponder,
        peer_is_citizen: peerIsCitizen,
        peer_is_responder: peerIsResponder,
      };
    });
  } catch (error: any) {
    console.error('Error fetching chat messages:', error.response?.data || error.message);
    return [];
  }
};

export const addChatMessage = async (
  reportId: number,
  message: {
    report_id: number;
    name?: string;
    message: string;
    sender?: string;
    receiver?: number;
    receiver_id?: number;
    conversation_target?: 'citizen' | 'dispatcher';
    timestamp?: string;
    image?: string;
  }
): Promise<void> => {
  try {
    if (!message.message || !message.message.trim()) {
      throw new Error('Message content is required');
    }

    const { getStoredUser } = await import('../components/lib/auth');
    const userData = await getStoredUser();
    const userId = userData?.user?.id;
    if (!userId) {
      throw new Error('User not authenticated');
    }

    const receiverId = message.receiver ?? message.receiver_id;

    let payload: any;
    let config: any = {};

    if (message.image) {
      payload = new FormData();
      payload.append('report_id', String(reportId));
      payload.append('sender_id', String(userId));
      if (typeof receiverId === 'number' && Number.isFinite(receiverId) && receiverId > 0) {
        payload.append('receiver_id', String(receiverId));
      }
      if (message.conversation_target) {
        payload.append('conversation_target', message.conversation_target);
      }
      payload.append('message', message.message.trim());

      const imageUri = message.image;
      const filename = imageUri.split('/').pop() || 'image.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : 'image/jpeg';

      payload.append('image', {
        uri: imageUri,
        name: filename,
        type,
      } as any);

      config = {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      };
    } else {
      payload = {
        report_id: reportId,
        sender_id: userId,
        message: message.message.trim(),
      };
      if (typeof receiverId === 'number' && Number.isFinite(receiverId) && receiverId > 0) {
        payload.receiver_id = receiverId;
      }
      if (message.conversation_target) {
        payload.conversation_target = message.conversation_target;
      }

      config = {};
    }

    await api.post('/responder/sendChat', payload, config);
  } catch (err) {
    const error: any = err;
    if (error?.response) {
      console.warn('Failed to add chat message:', error.response.status, error.response.data);
    } else {
      console.warn('Failed to add chat message:', error);
    }
    throw err;
  }
};

export const STATUS_FLOW: string[] = ['Pending', 'Ongoing', 'Arrived', 'Completed', 'Cleared'];

export const STATUS_COLORS: Record<string, string> = {
  Pending: '#f97316',
  Ongoing: '#3b82f6',
  Arrived: '#22c55e',
  Completed: '#10b981',
  Cancelled: '#ef4444',
  Duplicate: '#CAB603',
  Cleared: '#08D38F',
};

export const DEFAULT_CONFIG: AppConfig = {
  app_title: 'Responder',
  responder_name: 'Unit 12',
  primary_color: '#3B82F6',
  secondary_color: '#1E293B',
  accent_color: '#10B981',
  text_color: '#F8FAFC',
  background_color: '#0F172A',
};

export const THEMES: Record<string, Theme> = {
  dark: {
    background: '#0F172A',
    surface: '#1E293B',
    surfaceAlt: '#334155',
    text: '#F8FAFC',
    textSecondary: '#94A3B8',
    border: '#334155',
    mapBg: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
  },
  light: {
    background: '#F8FAFC',
    surface: '#FFFFFF',
    surfaceAlt: '#E2E8F0',
    text: '#0F172A',
    textSecondary: '#475569',
    border: '#CBD5E1',
    mapBg: 'linear-gradient(135deg, #E0E7FF 0%, #DBEAFE 50%, #BFDBFE 100%)',
  },
};
