import { RecognitionPreferences, Patient, Person, ActivityLogEntry } from '@/types';
import { getApiBaseUrl } from '@/utils/recognitionApi';

type PatientResponse = Patient;

type PeopleResponse = Person[];

type LogsResponse = ActivityLogEntry[];

export interface RecallMemoryResponse {
  query: string;
  response_text: string;
  matched_memories: Array<{
    person_name: string;
    date: string;
    summary: string;
    is_important: boolean;
    image_url?: string | null;
  }>;
  audio_generated: boolean;
  audio_url?: string | null;
}

export interface MemoryAgentHealthResponse {
  status: string;
  agent_id: string;
  has_elevenlabs_key: boolean;
}

export interface MemoryAgentConfigResponse {
  patientId: string;
  agentId: string;
  websocketUrl: string;
  signedUrl?: string | null;
  conversationToken?: string | null;
  warnings?: string[] | null;
  personName?: string | null;
  contextText: string;
  memoriesCount: number;
}

export interface MemoryAgentNameStateResponse {
  name?: string | null;
  updatedAt?: string | null;
}

export interface PatientMemoryRecord {
  id: string;
  patient_id: string;
  person_id: string;
  person_name: string;
  transcription?: string | null;
  audio_url?: string | null;
  summary?: string | null;
  is_important: boolean;
  created_at?: string | null;
  custom_image_url?: string | null;
}

export interface MemoryCustomImageResponse {
  memory_id: string;
  image_url: string;
}

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

export async function fetchPatientMemories(
  patientId: string,
  options?: { limit?: number; offset?: number }
): Promise<PatientMemoryRecord[]> {
  const params = new URLSearchParams();
  if (typeof options?.limit === 'number') {
    params.set('limit', String(options.limit));
  }
  if (typeof options?.offset === 'number') {
    params.set('offset', String(options.offset));
  }
  const suffix = params.toString() ? `?${params.toString()}` : '';

  const response = await fetch(`${getApiBaseUrl()}/patient-mode/patients/${patientId}/memories${suffix}`);
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Failed to fetch memories (${response.status}): ${detail}`);
  }
  return (await response.json()) as PatientMemoryRecord[];
}

export async function generateMemoryCustomImage(memoryId: string): Promise<MemoryCustomImageResponse> {
  const response = await fetch(`${getApiBaseUrl()}/patient-mode/memories/${memoryId}/custom-image`, {
    method: 'POST',
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Failed to generate memory image (${response.status}): ${detail}`);
  }
  return (await response.json()) as MemoryCustomImageResponse;
}

export async function recallMemory(
  patientId: string,
  query: string,
  personId?: string
): Promise<RecallMemoryResponse> {
  const response = await fetch(`${getApiBaseUrl()}/patients/${patientId}/recall`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query,
      person_id: personId ?? null,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Failed to recall memory (${response.status}): ${detail}`);
  }

  return (await response.json()) as RecallMemoryResponse;
}

export async function fetchMemoryAgentHealth(): Promise<MemoryAgentHealthResponse> {
  const response = await fetch(`${getApiBaseUrl()}/patient-mode/agent/health`);
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Failed to fetch memory-agent health (${response.status}): ${detail}`);
  }
  return (await response.json()) as MemoryAgentHealthResponse;
}

export async function fetchMemoryAgentConfig(
  patientId: string,
  options?: {
    personId?: string;
    maxMemories?: number;
    agentId?: string;
    includeSignedUrl?: boolean;
    includeConversationToken?: boolean;
  }
): Promise<MemoryAgentConfigResponse> {
  const params = new URLSearchParams();
  if (options?.personId) {
    params.set('person_id', options.personId);
  }
  if (typeof options?.maxMemories === 'number') {
    params.set('max_memories', String(options.maxMemories));
  }
  if (options?.agentId) {
    params.set('agent_id', options.agentId);
  }
  if (options?.includeSignedUrl) {
    params.set('include_signed_url', 'true');
  }
  if (options?.includeConversationToken) {
    params.set('include_conversation_token', 'true');
  }
  const suffix = params.toString() ? `?${params.toString()}` : '';

  const response = await fetch(
    `${getApiBaseUrl()}/patient-mode/patients/${patientId}/memory-agent/config${suffix}`
  );
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Failed to fetch memory-agent config (${response.status}): ${detail}`);
  }
  return (await response.json()) as MemoryAgentConfigResponse;
}

export async function setMemoryAgentPersonName(name: string): Promise<MemoryAgentNameStateResponse> {
  const response = await fetch(`${getApiBaseUrl()}/patient-mode/agent/person-name`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Failed to set memory-agent name (${response.status}): ${detail}`);
  }
  return (await response.json()) as MemoryAgentNameStateResponse;
}
