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

export async function fetchAnnouncementAudio(personId: string): Promise<string | null> {
  try {
    const response = await fetch(`${getApiBaseUrl()}/patient-mode/people/${personId}/announcement-audio`);
    if (!response.ok) {
      return null;
    }
    const data = await response.json();
    return data.url ?? null;
  } catch {
    return null;
  }
}

export async function uploadMemory(
  patientId: string,
  personId: string,
  personName: string,
  audioUri: string
): Promise<void> {
  const formData = new FormData();
  formData.append(
    'audio',
    {
      uri: audioUri,
      name: `memory-${Date.now()}.m4a`,
      type: 'audio/m4a',
    } as unknown as Blob
  );
  formData.append('person_id', personId);
  formData.append('person_name', personName);

  const response = await fetch(`${getApiBaseUrl()}/patient-mode/patients/${patientId}/memories`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Failed to upload memory (${response.status}): ${detail}`);
  }
}
