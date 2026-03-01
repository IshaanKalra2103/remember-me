import { Patient, Person, ActivityLogEntry, RecognitionPreferences } from '@/types';

export const defaultPreferences: RecognitionPreferences = {
  autoPlayAnnouncement: true,
  preferVoiceMessage: true,
  allowAutoRepeat: false,
  confirmBehavior: 'when_unsure',
  showLargeName: true,
  showRelationship: true,
  calmingChime: true,
};

export const samplePatients: Patient[] = [
  {
    id: 'patient-1',
    name: 'Margaret',
    language: 'English',
    supervisionMode: true,
    autoPlayAudio: true,
    hasVoiceSample: false,
    createdAt: '2025-01-15T10:00:00Z',
  },
];

export const samplePeople: Person[] = [
  {
    id: 'person-1',
    patientId: 'patient-1',
    name: 'Priya',
    relationship: 'daughter',
    nickname: 'Pri',
    photos: [
      {
        id: 'photo-1',
        personId: 'person-1',
        storagePath: 'sample/1.jpg',
        url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop',
        createdAt: '2025-01-16T10:00:00Z',
      },
      {
        id: 'photo-2',
        personId: 'person-1',
        storagePath: 'sample/2.jpg',
        url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop',
        createdAt: '2025-01-16T10:00:00Z',
      },
      {
        id: 'photo-3',
        personId: 'person-1',
        storagePath: 'sample/3.jpg',
        url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200&h=200&fit=crop',
        createdAt: '2025-01-16T10:00:00Z',
      },
    ],
    hasVoiceMessage: true,
    hasAnnouncement: true,
    createdAt: '2025-01-16T10:00:00Z',
  },
  {
    id: 'person-2',
    patientId: 'patient-1',
    name: 'David',
    relationship: 'son',
    photos: [
      {
        id: 'photo-4',
        personId: 'person-2',
        storagePath: 'sample/4.jpg',
        url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop',
        createdAt: '2025-01-17T10:00:00Z',
      },
      {
        id: 'photo-5',
        personId: 'person-2',
        storagePath: 'sample/5.jpg',
        url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop',
        createdAt: '2025-01-17T10:00:00Z',
      },
      {
        id: 'photo-6',
        personId: 'person-2',
        storagePath: 'sample/6.jpg',
        url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop',
        createdAt: '2025-01-17T10:00:00Z',
      },
    ],
    hasVoiceMessage: false,
    hasAnnouncement: true,
    createdAt: '2025-01-17T10:00:00Z',
  },
  {
    id: 'person-3',
    patientId: 'patient-1',
    name: 'Dr. Nguyen',
    relationship: 'doctor',
    photos: [
      {
        id: 'photo-7',
        personId: 'person-3',
        storagePath: 'sample/7.jpg',
        url: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=200&h=200&fit=crop',
        createdAt: '2025-01-18T10:00:00Z',
      },
    ],
    hasVoiceMessage: false,
    hasAnnouncement: false,
    createdAt: '2025-01-18T10:00:00Z',
  },
];

export const sampleActivityLog: ActivityLogEntry[] = [
  {
    id: 'log-1',
    patientId: 'patient-1',
    type: 'identified',
    personName: 'Priya',
    confidence: 'high',
    timestamp: new Date().toISOString(),
  },
  {
    id: 'log-2',
    patientId: 'patient-1',
    type: 'audio_played',
    personName: 'Priya',
    timestamp: new Date(Date.now() - 60000).toISOString(),
  },
  {
    id: 'log-3',
    patientId: 'patient-1',
    type: 'unsure',
    timestamp: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 'log-4',
    patientId: 'patient-1',
    type: 'not_correct',
    personName: 'David',
    timestamp: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 'log-5',
    patientId: 'patient-1',
    type: 'help_requested',
    timestamp: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
];

export const relationships = [
  { label: 'Spouse', value: 'spouse' },
  { label: 'Daughter', value: 'daughter' },
  { label: 'Son', value: 'son' },
  { label: 'Friend', value: 'friend' },
  { label: 'Caregiver', value: 'caregiver' },
  { label: 'Doctor', value: 'doctor' },
  { label: 'Other', value: 'other' },
];
