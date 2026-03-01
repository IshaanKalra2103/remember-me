import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import createContextHook from '@nkzw/create-context-hook';
import { Image } from 'expo-image';
import {
  Patient,
  Person,
  ActivityLogEntry,
  RecognitionPreferences,
} from '@/types';
import {
  createLog,
  fetchLogs,
  fetchPatient,
  fetchPeople,
  fetchPreferences,
} from '@/utils/backendApi';
import { getRecognitionPatientId } from '@/utils/recognitionApi';
import {
  defaultPreferences,
  samplePatients,
  samplePeople,
  sampleActivityLog,
} from '@/mocks/data';

const STORAGE_KEYS = {
  patients: 'rememberme_patients',
  people: 'rememberme_people',
  activityLog: 'rememberme_activity',
  preferences: 'rememberme_preferences',
  currentPatientId: 'rememberme_current_patient',
  isSignedIn: 'rememberme_signed_in',
  caregiverEmail: 'rememberme_caregiver_email',
  hasSeenWelcome: 'rememberme_has_seen_welcome',
  lastRecognition: 'rememberme_last_recognition',
};

export const [AppProvider, useApp] = createContextHook(() => {
  const queryClient = useQueryClient();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [currentPatientId, setCurrentPatientId] = useState<string | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([]);
  const [preferences, setPreferences] = useState<RecognitionPreferences>(defaultPreferences);
  const [isSignedIn, setIsSignedIn] = useState<boolean>(false);
  const [caregiverEmail, setCaregiverEmail] = useState<string | null>(null);
  const [hasSeenWelcome, setHasSeenWelcome] = useState<boolean>(false);
  const [lastRecognizedPerson, setLastRecognizedPerson] = useState<Person | null>(null);

  const dataQuery = useQuery({
    queryKey: ['appData'],
    queryFn: async () => {
      console.log('[AppProvider] Loading data from storage/backend...');
      const [
        storedPatients,
        storedPeople,
        storedActivity,
        storedPrefs,
        storedCurrentPatient,
        storedSignedIn,
        storedEmail,
        storedWelcome,
        storedLastRecognition,
      ] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.patients),
        AsyncStorage.getItem(STORAGE_KEYS.people),
        AsyncStorage.getItem(STORAGE_KEYS.activityLog),
        AsyncStorage.getItem(STORAGE_KEYS.preferences),
        AsyncStorage.getItem(STORAGE_KEYS.currentPatientId),
        AsyncStorage.getItem(STORAGE_KEYS.isSignedIn),
        AsyncStorage.getItem(STORAGE_KEYS.caregiverEmail),
        AsyncStorage.getItem(STORAGE_KEYS.hasSeenWelcome),
        AsyncStorage.getItem(STORAGE_KEYS.lastRecognition),
      ]);

      const configuredPatientId = getRecognitionPatientId(storedCurrentPatient || null);
      if (configuredPatientId) {
        try {
          const [patient, people, prefs, logs] = await Promise.all([
            fetchPatient(configuredPatientId),
            fetchPeople(configuredPatientId),
            fetchPreferences(configuredPatientId),
            fetchLogs(configuredPatientId),
          ]);

          const photoUrls = people.flatMap((person) =>
            person.photos.map((photo) => photo.url)
          );
          await Promise.all(photoUrls.map((url) => Image.prefetch(url)));

          return {
            patients: [patient],
            people,
            activityLog: logs,
            preferences: prefs,
            currentPatientId: patient.id,
            isSignedIn: storedSignedIn === 'true',
            caregiverEmail: storedEmail || null,
            hasSeenWelcome: storedWelcome === 'true',
            lastRecognizedPerson: storedLastRecognition
              ? JSON.parse(storedLastRecognition)
              : null,
          };
        } catch (error) {
          console.warn('[AppProvider] Backend load failed, falling back to storage.', error);
        }
      }

      return {
        patients: storedPatients ? JSON.parse(storedPatients) : samplePatients,
        people: storedPeople ? JSON.parse(storedPeople) : samplePeople,
        activityLog: storedActivity ? JSON.parse(storedActivity) : sampleActivityLog,
        preferences: storedPrefs ? JSON.parse(storedPrefs) : defaultPreferences,
        currentPatientId: storedCurrentPatient || samplePatients[0]?.id || null,
        isSignedIn: storedSignedIn === 'true',
        caregiverEmail: storedEmail || null,
        hasSeenWelcome: storedWelcome === 'true',
        lastRecognizedPerson: storedLastRecognition ? JSON.parse(storedLastRecognition) : null,
      };
    },
  });

  useEffect(() => {
    if (dataQuery.data) {
      setPatients(dataQuery.data.patients);
      setPeople(dataQuery.data.people);
      setActivityLog(dataQuery.data.activityLog);
      setPreferences(dataQuery.data.preferences);
      setCurrentPatientId(dataQuery.data.currentPatientId);
      setIsSignedIn(dataQuery.data.isSignedIn);
      setCaregiverEmail(dataQuery.data.caregiverEmail);
      setHasSeenWelcome(dataQuery.data.hasSeenWelcome);
      setLastRecognizedPerson(dataQuery.data.lastRecognizedPerson);
    }
  }, [dataQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async (updates: Record<string, string>) => {
      const entries = Object.entries(updates);
      await Promise.all(entries.map(([key, value]) => AsyncStorage.setItem(key, value)));
    },
  });

  useEffect(() => {
    if (!dataQuery.data) {
      return;
    }
    saveMutation.mutate({
      [STORAGE_KEYS.patients]: JSON.stringify(dataQuery.data.patients),
      [STORAGE_KEYS.people]: JSON.stringify(dataQuery.data.people),
      [STORAGE_KEYS.activityLog]: JSON.stringify(dataQuery.data.activityLog),
      [STORAGE_KEYS.preferences]: JSON.stringify(dataQuery.data.preferences),
      [STORAGE_KEYS.currentPatientId]: dataQuery.data.currentPatientId ?? '',
      [STORAGE_KEYS.isSignedIn]: dataQuery.data.isSignedIn ? 'true' : 'false',
      [STORAGE_KEYS.caregiverEmail]: dataQuery.data.caregiverEmail ?? '',
      [STORAGE_KEYS.hasSeenWelcome]: dataQuery.data.hasSeenWelcome ? 'true' : 'false',
      [STORAGE_KEYS.lastRecognition]: dataQuery.data.lastRecognizedPerson
        ? JSON.stringify(dataQuery.data.lastRecognizedPerson)
        : '',
    });
  }, [dataQuery.data, saveMutation]);

  const currentPatient = useMemo(
    () => patients.find((p) => p.id === currentPatientId) ?? null,
    [patients, currentPatientId]
  );

  const currentPeople = useMemo(
    () => people.filter((p) => p.patientId === currentPatientId),
    [people, currentPatientId]
  );

  const currentActivityLog = useMemo(
    () => activityLog.filter((l) => l.patientId === currentPatientId),
    [activityLog, currentPatientId]
  );

  const signIn = useCallback(
    (email: string) => {
      console.log('[AppProvider] Signing in:', email);
      setIsSignedIn(true);
      setCaregiverEmail(email);
      saveMutation.mutate({
        [STORAGE_KEYS.isSignedIn]: 'true',
        [STORAGE_KEYS.caregiverEmail]: email,
      });
    },
    [saveMutation]
  );

  const signOut = useCallback(() => {
    console.log('[AppProvider] Signing out');
    setIsSignedIn(false);
    setCaregiverEmail(null);
    saveMutation.mutate({
      [STORAGE_KEYS.isSignedIn]: 'false',
      [STORAGE_KEYS.caregiverEmail]: '',
    });
  }, [saveMutation]);

  const markWelcomeSeen = useCallback(() => {
    setHasSeenWelcome(true);
    saveMutation.mutate({ [STORAGE_KEYS.hasSeenWelcome]: 'true' });
  }, [saveMutation]);

  const addPatient = useCallback(
    (patient: Patient) => {
      console.log('[AppProvider] Adding patient:', patient.name);
      const updated = [...patients, patient];
      setPatients(updated);
      setCurrentPatientId(patient.id);
      saveMutation.mutate({
        [STORAGE_KEYS.patients]: JSON.stringify(updated),
        [STORAGE_KEYS.currentPatientId]: patient.id,
      });
    },
    [patients, saveMutation]
  );

  const updatePatient = useCallback(
    (patient: Patient) => {
      const updated = patients.map((p) => (p.id === patient.id ? patient : p));
      setPatients(updated);
      saveMutation.mutate({ [STORAGE_KEYS.patients]: JSON.stringify(updated) });
    },
    [patients, saveMutation]
  );

  const selectPatient = useCallback(
    (id: string) => {
      setCurrentPatientId(id);
      saveMutation.mutate({ [STORAGE_KEYS.currentPatientId]: id });
    },
    [saveMutation]
  );

  const addPerson = useCallback(
    (person: Person) => {
      console.log('[AppProvider] Adding person:', person.name);
      const updated = [...people, person];
      setPeople(updated);
      saveMutation.mutate({ [STORAGE_KEYS.people]: JSON.stringify(updated) });
    },
    [people, saveMutation]
  );

  const updatePerson = useCallback(
    (person: Person) => {
      const updated = people.map((p) => (p.id === person.id ? person : p));
      setPeople(updated);
      saveMutation.mutate({ [STORAGE_KEYS.people]: JSON.stringify(updated) });
    },
    [people, saveMutation]
  );

  const removePerson = useCallback(
    (personId: string) => {
      console.log('[AppProvider] Removing person:', personId);
      const updated = people.filter((p) => p.id !== personId);
      setPeople(updated);
      saveMutation.mutate({ [STORAGE_KEYS.people]: JSON.stringify(updated) });
    },
    [people, saveMutation]
  );

  const pendingLogSync = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingLogEntries = useRef<{ localId: string; patientId: string; entry: Omit<ActivityLogEntry, 'id' | 'timestamp'> }[]>([]);

  const flushLogSync = useCallback(() => {
    const entries = pendingLogEntries.current.splice(0);
    if (!entries.length) return;

    entries.forEach(({ localId, patientId, entry }) => {
      createLog(patientId, entry)
        .then((saved) => {
          setActivityLog((prev) => {
            const filtered = prev.filter((log) => log.id !== localId);
            return [saved, ...filtered];
          });
        })
        .catch((error) => {
          console.warn('[AppProvider] Failed to sync log:', error);
        });
    });
  }, []);

  const addActivityLogEntry = useCallback(
    (entry: Omit<ActivityLogEntry, 'id' | 'timestamp'>) => {
      const newEntry: ActivityLogEntry = {
        ...entry,
        id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: new Date().toISOString(),
      };
      setActivityLog((prev) => {
        const updated = [newEntry, ...prev];
        saveMutation.mutate({ [STORAGE_KEYS.activityLog]: JSON.stringify(updated) });
        return updated;
      });

      if (currentPatientId) {
        pendingLogEntries.current.push({
          localId: newEntry.id,
          patientId: currentPatientId,
          entry,
        });

        // Debounce backend sync to batch rapid log entries
        if (pendingLogSync.current) {
          clearTimeout(pendingLogSync.current);
        }
        pendingLogSync.current = setTimeout(flushLogSync, 500);
      }
    },
    [currentPatientId, saveMutation, flushLogSync]
  );

  const updatePreferences = useCallback(
    (prefs: Partial<RecognitionPreferences>) => {
      const updated = { ...preferences, ...prefs };
      setPreferences(updated);
      saveMutation.mutate({ [STORAGE_KEYS.preferences]: JSON.stringify(updated) });
    },
    [preferences, saveMutation]
  );

  const setLastRecognition = useCallback(
    (person: Person | null) => {
      setLastRecognizedPerson(person);
      saveMutation.mutate({
        [STORAGE_KEYS.lastRecognition]: person ? JSON.stringify(person) : '',
      });
    },
    [saveMutation]
  );

  const refreshPatients = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['appData'] });
  }, [queryClient]);

  return {
    patients,
    currentPatient,
    currentPatientId,
    currentPeople,
    currentActivityLog,
    people,
    activityLog,
    preferences,
    isSignedIn,
    caregiverEmail,
    hasSeenWelcome,
    lastRecognizedPerson,
    isLoading: dataQuery.isLoading,
    signIn,
    signOut,
    markWelcomeSeen,
    addPatient,
    updatePatient,
    selectPatient,
    addPerson,
    updatePerson,
    removePerson,
    addActivityLogEntry,
    updatePreferences,
    setLastRecognition,
    refreshPatients,
  };
});
