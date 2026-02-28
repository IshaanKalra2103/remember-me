import Constants from 'expo-constants';

type RecognitionStatus = 'identified' | 'unsure' | 'not_sure';
type ConfidenceBand = 'high' | 'medium' | 'low';

export interface RecognitionApiCandidate {
  personId: string;
  name: string;
  confidence: number;
}

export interface RecognitionApiResult {
  eventId: string;
  status: RecognitionStatus;
  confidenceScore: number | null;
  confidenceBand: ConfidenceBand | null;
  winnerPersonId?: string | null;
  candidates: RecognitionApiCandidate[];
  needsTieBreak: boolean;
}

const getConfigValue = (key: string): string | undefined => {
  const expoExtra = (Constants.expoConfig?.extra ?? {}) as Record<string, string | undefined>;
  return expoExtra[key] ?? process.env[key];
};

export const getApiBaseUrl = () =>
  getConfigValue('EXPO_PUBLIC_API_BASE_URL')?.replace(/\/$/, '') ??
  'http://127.0.0.1:8000/v1';

export const getRecognitionPatientId = (fallbackPatientId: string | null) => {
  const configuredPatientId = getConfigValue('EXPO_PUBLIC_PATIENT_ID');
  return configuredPatientId || fallbackPatientId;
};

export async function createRecognitionSession(patientId: string) {
  const response = await fetch(`${getApiBaseUrl()}/patients/${patientId}/sessions`, {
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error(`Failed to create session (${response.status})`);
  }

  const data = await response.json();
  return data as { id: string; patientId: string; createdAt: string };
}

export async function submitRecognitionSeed(sessionId: string, seed: string) {
  const body = new FormData();
  body.append('seed', seed);

  const response = await fetch(`${getApiBaseUrl()}/sessions/${sessionId}/frame`, {
    method: 'POST',
    body,
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Recognition failed (${response.status}): ${detail}`);
  }

  const data = await response.json();
  return data as RecognitionApiResult;
}
