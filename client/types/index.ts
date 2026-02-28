// ─── Core Domain Types ───────────────────────────────────────────────────────

export interface Patient {
  id: string;
  caregiverId?: string;
  name: string;
  language: string;
  avatarUrl?: string;
  pinHash?: string;
  supervisionMode: boolean;
  autoPlayAudio: boolean;
  createdAt: string;
}

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
  photos: Photo[];
  hasVoiceMessage: boolean;
  hasAnnouncement: boolean;
  createdAt: string;
}

export type RelationshipType =
  | 'spouse'
  | 'daughter'
  | 'son'
  | 'friend'
  | 'caregiver'
  | 'doctor'
  | 'other';

export interface ActivityLogEntry {
  id: string;
  patientId: string;
  type: 'identified' | 'unsure' | 'not_correct' | 'audio_played' | 'help_requested';
  personName?: string;
  confidence?: number | 'high' | 'low';
  timestamp: string;
  note?: string;
}

export interface RecognitionPreferences {
  patientId?: string;
  autoPlayAnnouncement: boolean;
  preferVoiceMessage: boolean;
  allowAutoRepeat: boolean;
  confirmBehavior: 'always' | 'when_unsure' | 'never';
  showLargeName: boolean;
  showRelationship: boolean;
  calmingChime: boolean;
}

// ─── Recognition Types ───────────────────────────────────────────────────────

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

export interface Session {
  id: string;
  patientId: string;
  createdAt: string;
}

// ─── Auth Types ──────────────────────────────────────────────────────────────

export interface Caregiver {
  id: string;
  email: string;
  createdAt: string;
}

// ─── App State ───────────────────────────────────────────────────────────────

export interface AppState {
  patients: Patient[];
  currentPatientId: string | null;
  people: Person[];
  activityLog: ActivityLogEntry[];
  preferences: RecognitionPreferences;
  isSignedIn: boolean;
  caregiverEmail: string | null;
  caregiver: Caregiver | null;
}

// ─── Helper Functions ────────────────────────────────────────────────────────

export function getPhotoUrls(person: Person): string[] {
  return person.photos.map((p) => p.url);
}
