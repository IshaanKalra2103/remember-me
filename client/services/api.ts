import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApiBaseUrl } from '@/utils/recognitionApi';

const API_BASE_URL = getApiBaseUrl();

const TOKEN_KEY = 'rememberme_auth_token';

// ─── Token Management ────────────────────────────────────────────────────────

export async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function setToken(token: string): Promise<void> {
  await AsyncStorage.setItem(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  await AsyncStorage.removeItem(TOKEN_KEY);
}

// ─── HTTP Client ─────────────────────────────────────────────────────────────

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  auth?: boolean;
  formData?: FormData;
  timeout?: number;
}

class ApiError extends Error {
  constructor(
    public status: number,
    public detail: string
  ) {
    super(detail);
    this.name = 'ApiError';
  }
}

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = true, formData, timeout = 30000 } = options;

  const headers: Record<string, string> = {};

  if (auth) {
    const token = await getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  if (body && !formData) {
    headers['Content-Type'] = 'application/json';
  }

  const config: RequestInit = {
    method,
    headers,
  };

  if (formData) {
    config.body = formData;
  } else if (body) {
    config.body = JSON.stringify(body);
  }

  // Add timeout using AbortController
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  config.signal = controller.signal;

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
    clearTimeout(timeoutId);

    if (!response.ok) {
      let detail = 'Request failed';
      try {
        const error = await response.json();
        detail = error.detail || detail;
      } catch {}
      throw new ApiError(response.status, detail);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ApiError(408, 'Request timeout');
    }
    throw error;
  }
}

// ─── Auth API ────────────────────────────────────────────────────────────────

export interface Caregiver {
  id: string;
  email: string;
  createdAt: string;
}

export interface AuthVerifyResponse {
  token: string;
  caregiver: Caregiver;
}

export const authApi = {
  start: (email: string) =>
    request<{ message: string; email: string }>('/auth/start', {
      method: 'POST',
      body: { email },
      auth: false,
    }),

  verify: (email: string, code: string) =>
    request<AuthVerifyResponse>('/auth/verify', {
      method: 'POST',
      body: { email, code },
      auth: false,
    }),

  me: () => request<Caregiver>('/auth/me'),
};

// ─── Patients API ────────────────────────────────────────────────────────────

export interface Patient {
  id: string;
  caregiverId: string;
  name: string;
  language: string;
  avatarUrl?: string;
  supervisionMode: boolean;
  autoPlayAudio: boolean;
  hasVoiceSample: boolean;
  createdAt: string;
}

export interface PatientCreate {
  name: string;
  language?: string;
}

export interface PatientUpdate {
  name?: string;
  language?: string;
  avatarUrl?: string;
  supervisionMode?: boolean;
  autoPlayAudio?: boolean;
}

export interface RecognitionPreferences {
  patientId: string;
  autoPlayAnnouncement: boolean;
  preferVoiceMessage: boolean;
  allowAutoRepeat: boolean;
  confirmBehavior: string;
  showLargeName: boolean;
  showRelationship: boolean;
  calmingChime: boolean;
}

export interface Session {
  id: string;
  patientId: string;
  createdAt: string;
}

export interface VoiceSampleResponse {
  success: boolean;
  message: string;
}

export const patientsApi = {
  list: () => request<Patient[]>('/patients'),

  create: (data: PatientCreate) =>
    request<Patient>('/patients', { method: 'POST', body: data }),

  get: (id: string) => request<Patient>(`/patients/${id}`),

  update: (id: string, data: PatientUpdate) =>
    request<Patient>(`/patients/${id}`, { method: 'PATCH', body: data }),

  getPreferences: (id: string) =>
    request<RecognitionPreferences>(`/patients/${id}/preferences`),

  updatePreferences: (id: string, prefs: Partial<RecognitionPreferences>) =>
    request<RecognitionPreferences>(`/patients/${id}/preferences`, {
      method: 'PATCH',
      body: prefs,
    }),

  createSession: (id: string) =>
    request<Session>(`/patients/${id}/sessions`, { method: 'POST' }),

  uploadVoiceSample: async (id: string, uri: string, mimeType = 'audio/m4a') => {
    console.log('[api] uploadVoiceSample URI:', uri);

    const formData = new FormData();
    // React Native FormData expects uri without modification
    formData.append('file', {
      uri: uri,
      name: `voice-sample-${Date.now()}.m4a`,
      type: mimeType,
    } as unknown as Blob);

    // Use direct fetch for file uploads to avoid potential issues with the request wrapper
    const token = await getToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000);

    try {
      console.log('[api] Starting upload to:', `${API_BASE_URL}/patients/${id}/voice-sample`);
      const response = await fetch(`${API_BASE_URL}/patients/${id}/voice-sample`, {
        method: 'POST',
        headers,
        body: formData,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Upload failed' }));
        throw new ApiError(response.status, error.detail || 'Upload failed');
      }

      return response.json() as Promise<VoiceSampleResponse>;
    } catch (error) {
      clearTimeout(timeoutId);
      console.error('[api] Upload error:', error);
      throw error;
    }
  },
};

// ─── People API ──────────────────────────────────────────────────────────────

export interface Photo {
  id: string;
  personId: string;
  storagePath: string;
  url: string;
  createdAt: string;
}

export interface Person {
  id: string;
  patientId: string;
  name: string;
  relationship?: string;
  nickname?: string;
  hasVoiceMessage: boolean;
  hasAnnouncement: boolean;
  photos: Photo[];
  createdAt: string;
}

export interface PersonCreate {
  name: string;
  relationship?: string;
  nickname?: string;
}

export interface PersonUpdate {
  name?: string;
  relationship?: string;
  nickname?: string;
}

export const peopleApi = {
  list: (patientId: string) => request<Person[]>(`/patients/${patientId}/people`),

  create: (patientId: string, data: PersonCreate) =>
    request<Person>(`/patients/${patientId}/people`, { method: 'POST', body: data }),

  get: (personId: string) => request<Person>(`/people/${personId}`),

  update: (personId: string, data: PersonUpdate) =>
    request<Person>(`/people/${personId}`, { method: 'PATCH', body: data }),

  delete: (personId: string) =>
    request<void>(`/people/${personId}`, { method: 'DELETE' }),

  uploadPhoto: async (personId: string, uri: string, mimeType = 'image/jpeg') => {
    const formData = new FormData();
    formData.append('file', {
      uri,
      name: `photo-${Date.now()}.jpg`,
      type: mimeType,
    } as unknown as Blob);
    return request<Photo>(`/people/${personId}/photos`, {
      method: 'POST',
      formData,
    });
  },

  deletePhoto: (personId: string, photoId: string) =>
    request<void>(`/people/${personId}/photos/${photoId}`, { method: 'DELETE' }),

  uploadVoice: async (personId: string, uri: string, mimeType = 'audio/mpeg') => {
    const formData = new FormData();
    formData.append('file', {
      uri,
      name: `voice-${Date.now()}.mp3`,
      type: mimeType,
    } as unknown as Blob);
    return request<{ url: string }>(`/people/${personId}/voice`, {
      method: 'POST',
      formData,
    });
  },
};

// ─── Recognition API ─────────────────────────────────────────────────────────

export interface RecognitionCandidate {
  personId: string;
  name: string;
  confidence: number;
}

export interface RecognitionResult {
  eventId: string;
  status: 'identified' | 'unsure' | 'not_sure';
  confidenceScore?: number;
  confidenceBand?: 'high' | 'medium' | 'low';
  winnerPersonId?: string;
  candidates: RecognitionCandidate[];
  needsTieBreak: boolean;
}

export interface RecognitionEvent {
  id: string;
  sessionId: string;
  status: string;
  confidenceScore?: number;
  confidenceBand?: string;
  winnerPersonId?: string;
  candidates: RecognitionCandidate[];
  needsTieBreak: boolean;
  createdAt: string;
}

export const recognitionApi = {
  submitFrame: async (sessionId: string, imageUri: string) => {
    const formData = new FormData();
    formData.append('file', {
      uri: imageUri,
      name: `frame-${Date.now()}.jpg`,
      type: 'image/jpeg',
    } as unknown as Blob);
    return request<RecognitionResult>(`/sessions/${sessionId}/frame`, {
      method: 'POST',
      formData,
      auth: false,
    });
  },

  tiebreak: (sessionId: string, selectedPersonId: string) =>
    request<RecognitionResult>(`/sessions/${sessionId}/tiebreak`, {
      method: 'POST',
      body: { selectedPersonId },
      auth: false,
    }),

  getResult: (sessionId: string, eventId: string) =>
    request<RecognitionEvent>(`/sessions/${sessionId}/result/${eventId}`, {
      auth: false,
    }),
};

// ─── Audio API ───────────────────────────────────────────────────────────────

export interface AnnouncementAudioResponse {
  url: string;
  cached: boolean;
}

export const audioApi = {
  generateAnnouncement: (personId: string) =>
    request<AnnouncementAudioResponse>(`/people/${personId}/announcement-audio`, {
      method: 'POST',
    }),
};

// ─── Activity Logs API ───────────────────────────────────────────────────────

export interface ActivityLog {
  id: string;
  patientId: string;
  type: 'identified' | 'unsure' | 'not_correct' | 'audio_played' | 'help_requested';
  personName?: string;
  confidence?: number;
  note?: string;
  timestamp: string;
}

export interface ActivityLogCreate {
  type: string;
  personName?: string;
  confidence?: number;
  note?: string;
}

export const logsApi = {
  list: (patientId: string, params?: { limit?: number; offset?: number; type?: string }) => {
    const query = new URLSearchParams();
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.offset) query.set('offset', String(params.offset));
    if (params?.type) query.set('type', params.type);
    const queryStr = query.toString();
    return request<ActivityLog[]>(`/patients/${patientId}/logs${queryStr ? '?' + queryStr : ''}`);
  },

  create: (patientId: string, data: ActivityLogCreate) =>
    request<ActivityLog>(`/patients/${patientId}/logs`, { method: 'POST', body: data }),
};

// ─── Export All ──────────────────────────────────────────────────────────────

export { ApiError };
