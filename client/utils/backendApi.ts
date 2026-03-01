import { RecognitionPreferences, Patient, Person, ActivityLogEntry } from '@/types';
import { getApiBaseUrl } from '@/utils/recognitionApi';

type PatientResponse = Patient;

type PeopleResponse = Person[];

type LogsResponse = ActivityLogEntry[];

export async function fetchPatient(patientId: string) {
  const response = await fetch(`${getApiBaseUrl()}/patient-mode/patients/${patientId}`);
  if (!response.ok) {
    throw new Error(`Failed to load patient (${response.status})`);
  }
  return (await response.json()) as PatientResponse;
}

export async function fetchPeople(patientId: string) {
  const response = await fetch(`${getApiBaseUrl()}/patient-mode/patients/${patientId}/people`);
  if (!response.ok) {
    throw new Error(`Failed to load people (${response.status})`);
  }
  return (await response.json()) as PeopleResponse;
}

export async function fetchPreferences(patientId: string) {
  const response = await fetch(`${getApiBaseUrl()}/patient-mode/patients/${patientId}/preferences`);
  if (!response.ok) {
    throw new Error(`Failed to load preferences (${response.status})`);
  }
  return (await response.json()) as RecognitionPreferences;
}

export async function fetchLogs(patientId: string) {
  const response = await fetch(`${getApiBaseUrl()}/patient-mode/patients/${patientId}/logs`);
  if (!response.ok) {
    throw new Error(`Failed to load logs (${response.status})`);
  }
  return (await response.json()) as LogsResponse;
}

export async function createLog(patientId: string, entry: Omit<ActivityLogEntry, 'id' | 'timestamp'>) {
  const confidence =
    typeof entry.confidence === 'number' ? entry.confidence : undefined;
  const response = await fetch(`${getApiBaseUrl()}/patient-mode/patients/${patientId}/logs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: entry.type,
      personName: entry.personName,
      confidence,
      note: entry.note,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Failed to create log (${response.status}): ${detail}`);
  }

  return (await response.json()) as ActivityLogEntry;
}

export async function verifyPatientPin(patientId: string, pin: string) {
  const response = await fetch(`${getApiBaseUrl()}/patients/${patientId}/pin/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin }),
  });

  if (!response.ok) {
    return false;
  }

  const data = (await response.json()) as { valid: boolean };
  return data.valid;
}
