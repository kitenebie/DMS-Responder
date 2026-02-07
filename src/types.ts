// ==================== DATA TYPES ====================

export type IncidentStatus =
  | 'Pending'
  | 'Ongoing'
  | 'Arrived'
  | 'Completed'
  | 'Cleared';

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface Incident {
  id: string|null;
  type: string|null;
  location: string|null;
  coordinates: Coordinates|null;
  timeReported: string|null;
  description: string|null;
  priority: string|null;
  caller: string|null;
  callerPhone: string|null;
  status?: IncidentStatus|null;
  responder?: string|null;
  icon?: string|null;
  report_attachment?: string|null;
  isAccepted: boolean
}

export interface HistoricalIncident {
  id: string;
  type: string;
  location: string;
  timeReported: string;
  status: IncidentStatus;
  responder: string;
  description: string;
  actions_taken: string | null;
  time_completed?: string | null;
  additional_notes?: string | null;
  photo_path?: string | null;
}

export interface ChatMessage {
  id: number;
  sender: string;
  message: string;
  time: string;
  isUser: boolean;
  image?: string | null;
  timestamp?: string | null;
  sender_id?: number | null;
  receiver_id?: number | null;
}

export interface Theme {
  background: string;
  surface: string;
  surfaceAlt: string;
  text: string;
  textSecondary: string;
  border: string;
  mapBg: string;
}

export interface AppConfig {
  app_title: string;
  responder_name: string;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  text_color: string;
  background_color: string;
}

export interface ReportForm {
  actionsTaken: string;
  timeArrived: string;
  timeCompleted: string;
  additionalNotes: string;
}

export interface HistoryFilter {
  type: string;
  status: string;
}

export interface AppState {
  showIncomingModal: boolean;
  activeIncident: Incident | null;
  currentStatus: IncidentStatus;
  isMapFullscreen: boolean;
  showChat: boolean;
  showHistory: boolean;
  isDarkMode: boolean;
  chatMessages: ChatMessage[];
  newMessage: string;
  historySearch: string;
  historyFilter: HistoryFilter;
  reportForm: ReportForm;
}

export interface ReportStatus {
  id: number;
  report_id: number;
  user_id: number;
  is_accept: number;
  is_decline: number;
  decline_reason: string | null;
  created_at: string;
  updated_at: string;
  ongoing_at: string | null;
  arrived_at: string | null;
  completed_at: string | null;
  cleared_at: string | null;
  declined_at: string | null;
}
