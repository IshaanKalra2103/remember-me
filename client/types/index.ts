export interface Patient {
  id: string;
  name: string;
  language: string;
  avatarUrl?: string;
  pin: string;
  supervisionMode: boolean;
  autoPlayAudio: boolean;
  createdAt: string;
}

export interface Person {
  id: string;
  patientId: string;
  name: string;
  relationship: string;
  nickname?: string;
  photos: string[];
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
  confidence?: 'high' | 'medium' | 'low';
  timestamp: string;
  note?: string;
}

export interface RecognitionPreferences {
  autoPlayAnnouncement: boolean;
  preferVoiceMessage: boolean;
  allowAutoRepeat: boolean;
  confirmBehavior: 'always' | 'when_unsure' | 'never';
  showLargeName: boolean;
  showRelationship: boolean;
  calmingChime: boolean;
}

export interface AppState {
  patients: Patient[];
  currentPatientId: string | null;
  people: Person[];
  activityLog: ActivityLogEntry[];
  preferences: RecognitionPreferences;
  isSignedIn: boolean;
  caregiverEmail: string | null;
}
