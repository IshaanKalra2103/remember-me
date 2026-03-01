import { RecognitionPreferences } from '@/types';

export const defaultPreferences: RecognitionPreferences = {
  autoPlayAnnouncement: true,
  preferVoiceMessage: true,
  allowAutoRepeat: false,
  confirmBehavior: 'when_unsure',
  showLargeName: true,
  showRelationship: true,
  calmingChime: true,
};

export const relationships = [
  { label: 'Spouse', value: 'spouse' },
  { label: 'Daughter', value: 'daughter' },
  { label: 'Son', value: 'son' },
  { label: 'Friend', value: 'friend' },
  { label: 'Caregiver', value: 'caregiver' },
  { label: 'Doctor', value: 'doctor' },
  { label: 'Other', value: 'other' },
];
