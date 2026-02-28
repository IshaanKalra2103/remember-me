import React, { useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import createContextHook from '@nkzw/create-context-hook';
import {
  Patient,
  Person,
  ActivityLogEntry,
  RecognitionPreferences,
  Caregiver,
  Session,
  RecognitionResult,
  Photo,
} from '@/types';
import {
  authApi,
  patientsApi,
  peopleApi,
  logsApi,
  recognitionApi,
  getToken,
  setToken,
  clearToken,
  ApiError,
} from '@/services/api';
import { defaultPreferences } from '@/mocks/data';

const STORAGE_KEYS = {
  currentPatientId: 'rememberme_current_patient',
  hasSeenWelcome: 'rememberme_has_seen_welcome',
  lastRecognition: 'rememberme_last_recognition',
  currentSession: 'rememberme_current_session',
};

export const [AppProvider, useApp] = createContextHook(() => {
  const queryClient = useQueryClient();

  // Local UI state
  const [currentPatientId, setCurrentPatientId] = useState<string | null>(null);
  const [hasSeenWelcome, setHasSeenWelcome] = useState<boolean>(false);
  const [lastRecognizedPerson, setLastRecognizedPerson] = useState<Person | null>(null);
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // ─── Initialize from local storage ───────────────────────────────────────

  useEffect(() => {
    async function init() {
      const [token, patientId, welcome, lastRec, session] = await Promise.all([
        getToken(),
        AsyncStorage.getItem(STORAGE_KEYS.currentPatientId),
        AsyncStorage.getItem(STORAGE_KEYS.hasSeenWelcome),
        AsyncStorage.getItem(STORAGE_KEYS.lastRecognition),
        AsyncStorage.getItem(STORAGE_KEYS.currentSession),
      ]);
      setAuthToken(token);
      setCurrentPatientId(patientId);
      setHasSeenWelcome(welcome === 'true');
      if (lastRec) setLastRecognizedPerson(JSON.parse(lastRec));
      if (session) setCurrentSession(JSON.parse(session));
      setIsInitialized(true);
    }
    init();
  }, []);

  // ─── Caregiver Query ─────────────────────────────────────────────────────

  const caregiverQuery = useQuery({
    queryKey: ['caregiver'],
    queryFn: authApi.me,
    enabled: !!authToken,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const caregiver = caregiverQuery.data ?? null;
  const isSignedIn = !!authToken && !!caregiver;
  const caregiverEmail = caregiver?.email ?? null;

  // ─── Patients Query ──────────────────────────────────────────────────────

  const patientsQuery = useQuery({
    queryKey: ['patients'],
    queryFn: patientsApi.list,
    enabled: isSignedIn,
    staleTime: 60 * 1000,
  });

  const patients = patientsQuery.data ?? [];

  // Auto-select first patient if none selected
  useEffect(() => {
    if (patients.length > 0 && !currentPatientId) {
      selectPatient(patients[0].id);
    }
  }, [patients, currentPatientId]);

  // ─── People Query ────────────────────────────────────────────────────────

  const peopleQuery = useQuery({
    queryKey: ['people', currentPatientId],
    queryFn: () => peopleApi.list(currentPatientId!),
    enabled: isSignedIn && !!currentPatientId,
    staleTime: 60 * 1000,
  });

  const people = peopleQuery.data ?? [];

  // ─── Preferences Query ───────────────────────────────────────────────────

  const preferencesQuery = useQuery({
    queryKey: ['preferences', currentPatientId],
    queryFn: () => patientsApi.getPreferences(currentPatientId!),
    enabled: isSignedIn && !!currentPatientId,
    staleTime: 60 * 1000,
  });

  const preferences = preferencesQuery.data ?? defaultPreferences;

  // ─── Activity Log Query ──────────────────────────────────────────────────

  const activityQuery = useQuery({
    queryKey: ['activity', currentPatientId],
    queryFn: () => logsApi.list(currentPatientId!, { limit: 100 }),
    enabled: isSignedIn && !!currentPatientId,
    staleTime: 30 * 1000,
  });

  const activityLog = activityQuery.data ?? [];

  // ─── Derived State ───────────────────────────────────────────────────────

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

  // ─── Auth Mutations ──────────────────────────────────────────────────────

  const signInMutation = useMutation({
    mutationFn: async ({ email, code }: { email: string; code: string }) => {
      const result = await authApi.verify(email, code);
      await setToken(result.token);
      setAuthToken(result.token);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['caregiver'] });
      queryClient.invalidateQueries({ queryKey: ['patients'] });
    },
  });

  const startAuth = useCallback(async (email: string) => {
    return authApi.start(email);
  }, []);

  const signIn = useCallback(
    async (email: string, code: string) => {
      return signInMutation.mutateAsync({ email, code });
    },
    [signInMutation]
  );

  const signOut = useCallback(async () => {
    await clearToken();
    setAuthToken(null);
    setCurrentPatientId(null);
    queryClient.clear();
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.currentPatientId,
      STORAGE_KEYS.currentSession,
    ]);
  }, [queryClient]);

  // ─── Patient Mutations ───────────────────────────────────────────────────

  const addPatientMutation = useMutation({
    mutationFn: (data: { name: string; language?: string }) => patientsApi.create(data),
    onSuccess: (newPatient) => {
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      selectPatient(newPatient.id);
    },
  });

  const updatePatientMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof patientsApi.update>[1] }) =>
      patientsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients'] });
    },
  });

  const setPinMutation = useMutation({
    mutationFn: ({ id, pin }: { id: string; pin: string }) => patientsApi.setPin(id, pin),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients'] });
    },
  });

  const addPatient = useCallback(
    async (data: { name: string; language?: string }) => {
      return addPatientMutation.mutateAsync(data);
    },
    [addPatientMutation]
  );

  const updatePatient = useCallback(
    async (id: string, data: Parameters<typeof patientsApi.update>[1]) => {
      return updatePatientMutation.mutateAsync({ id, data });
    },
    [updatePatientMutation]
  );

  const setPin = useCallback(
    async (patientId: string, pin: string) => {
      return setPinMutation.mutateAsync({ id: patientId, pin });
    },
    [setPinMutation]
  );

  const verifyPin = useCallback(async (patientId: string, pin: string) => {
    const result = await patientsApi.verifyPin(patientId, pin);
    return result.valid;
  }, []);

  const selectPatient = useCallback(async (id: string) => {
    setCurrentPatientId(id);
    await AsyncStorage.setItem(STORAGE_KEYS.currentPatientId, id);
    queryClient.invalidateQueries({ queryKey: ['people', id] });
    queryClient.invalidateQueries({ queryKey: ['preferences', id] });
    queryClient.invalidateQueries({ queryKey: ['activity', id] });
  }, [queryClient]);

  // ─── People Mutations ────────────────────────────────────────────────────

  const addPersonMutation = useMutation({
    mutationFn: (data: { name: string; relationship?: string; nickname?: string }) =>
      peopleApi.create(currentPatientId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['people', currentPatientId] });
    },
  });

  const updatePersonMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof peopleApi.update>[1] }) =>
      peopleApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['people', currentPatientId] });
    },
  });

  const deletePersonMutation = useMutation({
    mutationFn: (id: string) => peopleApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['people', currentPatientId] });
    },
  });

  const uploadPhotoMutation = useMutation({
    mutationFn: ({ personId, uri }: { personId: string; uri: string }) =>
      peopleApi.uploadPhoto(personId, uri),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['people', currentPatientId] });
    },
  });

  const deletePhotoMutation = useMutation({
    mutationFn: ({ personId, photoId }: { personId: string; photoId: string }) =>
      peopleApi.deletePhoto(personId, photoId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['people', currentPatientId] });
    },
  });

  const addPerson = useCallback(
    async (data: { name: string; relationship?: string; nickname?: string }) => {
      return addPersonMutation.mutateAsync(data);
    },
    [addPersonMutation]
  );

  const updatePerson = useCallback(
    async (id: string, data: Parameters<typeof peopleApi.update>[1]) => {
      return updatePersonMutation.mutateAsync({ id, data });
    },
    [updatePersonMutation]
  );

  const removePerson = useCallback(
    async (id: string) => {
      return deletePersonMutation.mutateAsync(id);
    },
    [deletePersonMutation]
  );

  const uploadPhoto = useCallback(
    async (personId: string, uri: string) => {
      return uploadPhotoMutation.mutateAsync({ personId, uri });
    },
    [uploadPhotoMutation]
  );

  const deletePhoto = useCallback(
    async (personId: string, photoId: string) => {
      return deletePhotoMutation.mutateAsync({ personId, photoId });
    },
    [deletePhotoMutation]
  );

  // ─── Preferences Mutations ───────────────────────────────────────────────

  const updatePreferencesMutation = useMutation({
    mutationFn: (prefs: Partial<RecognitionPreferences>) =>
      patientsApi.updatePreferences(currentPatientId!, prefs),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['preferences', currentPatientId] });
    },
  });

  const updatePreferences = useCallback(
    async (prefs: Partial<RecognitionPreferences>) => {
      return updatePreferencesMutation.mutateAsync(prefs);
    },
    [updatePreferencesMutation]
  );

  // ─── Activity Log Mutations ──────────────────────────────────────────────

  const addLogMutation = useMutation({
    mutationFn: (entry: { type: string; personName?: string; confidence?: number; note?: string }) =>
      logsApi.create(currentPatientId!, entry),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activity', currentPatientId] });
    },
  });

  const addActivityLogEntry = useCallback(
    async (entry: { type: string; personName?: string; confidence?: number; note?: string }) => {
      if (!currentPatientId) return;
      return addLogMutation.mutateAsync(entry);
    },
    [addLogMutation, currentPatientId]
  );

  // ─── Recognition Session ─────────────────────────────────────────────────

  const createSession = useCallback(async () => {
    if (!currentPatientId) return null;
    const session = await patientsApi.createSession(currentPatientId);
    setCurrentSession(session);
    await AsyncStorage.setItem(STORAGE_KEYS.currentSession, JSON.stringify(session));
    return session;
  }, [currentPatientId]);

  const submitFrame = useCallback(
    async (imageUri: string): Promise<RecognitionResult | null> => {
      if (!currentSession) return null;
      return recognitionApi.submitFrame(currentSession.id, imageUri);
    },
    [currentSession]
  );

  const resolveTiebreak = useCallback(
    async (selectedPersonId: string): Promise<RecognitionResult | null> => {
      if (!currentSession) return null;
      return recognitionApi.tiebreak(currentSession.id, selectedPersonId);
    },
    [currentSession]
  );

  // ─── Last Recognition ────────────────────────────────────────────────────

  const setLastRecognition = useCallback(async (person: Person | null) => {
    setLastRecognizedPerson(person);
    await AsyncStorage.setItem(
      STORAGE_KEYS.lastRecognition,
      person ? JSON.stringify(person) : ''
    );
  }, []);

  // ─── Welcome ─────────────────────────────────────────────────────────────

  const markWelcomeSeen = useCallback(async () => {
    setHasSeenWelcome(true);
    await AsyncStorage.setItem(STORAGE_KEYS.hasSeenWelcome, 'true');
  }, []);

  // ─── Loading State ───────────────────────────────────────────────────────

  const isLoading =
    !isInitialized ||
    (isSignedIn &&
      (patientsQuery.isLoading || peopleQuery.isLoading || preferencesQuery.isLoading));

  // ─── Refresh ─────────────────────────────────────────────────────────────

  const refresh = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['patients'] }),
      queryClient.invalidateQueries({ queryKey: ['people'] }),
      queryClient.invalidateQueries({ queryKey: ['preferences'] }),
      queryClient.invalidateQueries({ queryKey: ['activity'] }),
    ]);
  }, [queryClient]);

  return {
    // State
    patients,
    currentPatient,
    currentPatientId,
    currentPeople,
    currentActivityLog,
    people,
    activityLog,
    preferences,
    isSignedIn,
    caregiver,
    caregiverEmail,
    hasSeenWelcome,
    lastRecognizedPerson,
    currentSession,
    isLoading,

    // Auth
    startAuth,
    signIn,
    signOut,
    signInPending: signInMutation.isPending,
    signInError: signInMutation.error,

    // Patient operations
    addPatient,
    updatePatient,
    selectPatient,
    setPin,
    verifyPin,

    // People operations
    addPerson,
    updatePerson,
    removePerson,
    uploadPhoto,
    deletePhoto,

    // Preferences
    updatePreferences,

    // Activity
    addActivityLogEntry,

    // Recognition
    createSession,
    submitFrame,
    resolveTiebreak,
    setLastRecognition,

    // Misc
    markWelcomeSeen,
    refresh,
  };
});
