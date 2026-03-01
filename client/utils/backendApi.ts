import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { RecognitionPreferences, Patient, Person, ActivityLogEntry } from '@/types';
import { getApiBaseUrl } from '@/utils/recognitionApi';

type PatientResponse = Patient;

type PeopleResponse = Person[];

type LogsResponse = ActivityLogEntry[];
type PatientPinMap = Record<string, string>;

const PATIENT_PINS_KEY = 'rememberme_patient_pins';

const getConfigValue = (key: string): string | undefined => {
  const expoExtra = (Constants.expoConfig?.extra ?? {}) as Record<string, string | undefined>;
  return process.env[key] ?? expoExtra[key];
};

async function readPatientPins(): Promise<PatientPinMap> {
  const stored = await AsyncStorage.getItem(PATIENT_PINS_KEY);
  if (!stored) return {};
  try {
    const parsed = JSON.parse(stored) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as PatientPinMap;
    }
  } catch (error) {
    console.warn('[backendApi] Failed to parse stored patient PINs:', error);
  }
  return {};
}

async function writePatientPins(pins: PatientPinMap) {
  await AsyncStorage.setItem(PATIENT_PINS_KEY, JSON.stringify(pins));
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

export async function verifyPatientPin(patientId: string, pin: string) {
  const pins = await readPatientPins();
  const storedPin = pins[patientId];
  if (storedPin) {
    return storedPin === pin;
  }

  const configuredPatientId = getConfigValue('EXPO_PUBLIC_PATIENT_ID');
  const configuredPin = getConfigValue('EXPO_PUBLIC_PATIENT_PIN');
  if (
    configuredPatientId === patientId &&
    typeof configuredPin === 'string' &&
    /^\d{4}$/.test(configuredPin)
  ) {
    return configuredPin === pin;
  }

  return false;
}

export async function setPatientPin(patientId: string, pin: string) {
  if (!/^\d{4}$/.test(pin)) {
    throw new Error('PIN must be exactly 4 digits.');
  }
  const pins = await readPatientPins();
  pins[patientId] = pin;
  await writePatientPins(pins);
}
