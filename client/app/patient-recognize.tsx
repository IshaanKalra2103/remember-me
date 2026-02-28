import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Camera, RefreshCw, Scan, UserRound } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useApp } from '@/providers/AppProvider';
import {
  createRecognitionSession,
  getRecognitionPatientId,
  submitRecognitionSeed,
} from '@/utils/recognitionApi';

const { width } = Dimensions.get('window');

interface SimulatedSubject {
  key: string;
  personId: string | null;
  label: string;
  subtitle: string;
}

export default function PatientRecognizeScreen() {
  const router = useRouter();
  const { currentPeople, addActivityLogEntry, currentPatientId, setLastRecognition } = useApp();
  const [isIdentifying, setIsIdentifying] = useState<boolean>(false);
  const [selectedSubjectIndex, setSelectedSubjectIndex] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0.6)).current;
  const scanLineAnim = useRef(new Animated.Value(0)).current;

  const simulatedSubjects = useMemo<SimulatedSubject[]>(
    () => [
      ...currentPeople.map((person) => ({
        key: person.id,
        personId: person.id,
        label: person.name,
        subtitle: `Demo face: ${person.relationship}`,
      })),
      {
        key: 'unknown',
        personId: null,
        label: 'Unknown visitor',
        subtitle: 'Forces the not sure path',
      },
    ],
    [currentPeople]
  );

  const selectedSubject = simulatedSubjects[selectedSubjectIndex] ?? simulatedSubjects[0];

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  useEffect(() => {
    setSelectedSubjectIndex((currentIndex) => {
      if (!simulatedSubjects.length) {
        return 0;
      }

      return currentIndex >= simulatedSubjects.length ? 0 : currentIndex;
    });
  }, [simulatedSubjects.length]);

  useEffect(() => {
    if (!isIdentifying) {
      return undefined;
    }

    const scanAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(scanLineAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(scanLineAnim, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    );
    scanAnimation.start();

    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.6,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    pulseAnimation.start();

    const runRecognition = async () => {
      const patientId = getRecognitionPatientId(currentPatientId);

      if (!patientId) {
        throw new Error('Set EXPO_PUBLIC_PATIENT_ID or create a real patient first.');
      }

      const session = await createRecognitionSession(patientId);
      const seed = selectedSubject?.personId
        ? `person-name:${selectedSubject.label}`
        : 'unknown';
      const result = await submitRecognitionSeed(session.id, seed);

      const topCandidate = result.candidates[0];
      const resolvedPerson =
        (result.winnerPersonId &&
          currentPeople.find((person) => person.id === result.winnerPersonId)) ||
        (topCandidate &&
          currentPeople.find(
            (person) =>
              person.id === topCandidate.personId || person.name === topCandidate.name
          )) ||
        (selectedSubject?.personId
          ? currentPeople.find((person) => person.id === selectedSubject.personId)
          : null) ||
        null;

      if (result.status === 'not_sure' || !resolvedPerson) {
        setLastRecognition(null);

        if (currentPatientId) {
          addActivityLogEntry({
            patientId: currentPatientId,
            type: 'unsure',
            confidence: 'low',
            note: 'Backend returned not sure',
          });
        }

        router.replace('/patient-not-sure');
        return;
      }

      setLastRecognition(resolvedPerson);

      if (currentPatientId) {
        addActivityLogEntry({
          patientId: currentPatientId,
          type: 'identified',
          personName: resolvedPerson.name,
          confidence: result.confidenceBand ?? 'medium',
          note: `Backend status: ${result.status}`,
        });
      }

      router.replace({
        pathname: '/patient-result',
        params: {
          personId: resolvedPerson.id,
          confidenceBand: result.confidenceBand ?? 'medium',
        },
      });
    };

    runRecognition()
      .catch((error) => {
        console.error('[PatientRecognize] Recognition error:', error);
        setErrorMessage(error instanceof Error ? error.message : 'Recognition failed');
        setLastRecognition(null);
      })
      .finally(() => {
        setIsIdentifying(false);
      });

    return () => {
      scanAnimation.stop();
      pulseAnimation.stop();
    };
  }, [
    addActivityLogEntry,
    currentPatientId,
    currentPeople,
    isIdentifying,
    pulseAnim,
    router,
    scanLineAnim,
    selectedSubject?.personId,
    selectedSubject?.key,
    setLastRecognition,
  ]);

  const handleIdentify = () => {
    if (!currentPeople.length) {
      router.replace('/patient-not-sure');
      return;
    }

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    setErrorMessage(null);
    setIsIdentifying(true);
  };

  const handleCycleSubject = () => {
    if (!simulatedSubjects.length || isIdentifying) {
      return;
    }

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    setErrorMessage(null);
    setSelectedSubjectIndex((currentIndex) => (currentIndex + 1) % simulatedSubjects.length);
  };

  return (
    <View style={styles.container}>
      <View style={styles.cameraPlaceholder}>
        <View style={styles.previewAvatar}>
          <UserRound size={56} color="rgba(255,255,255,0.75)" />
        </View>
        <Text style={styles.previewName}>{selectedSubject?.label ?? 'No one enrolled'}</Text>
        <Text style={styles.cameraPlaceholderText}>
          {selectedSubject?.subtitle ?? 'Add people in caregiver mode first'}
        </Text>
      </View>

      <View style={styles.overlay}>
        <SafeAreaView style={styles.safeArea}>
          <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
            <View style={styles.headerRow}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => router.back()}
                testID="recognize-back"
              >
                <ArrowLeft size={24} color={Colors.white} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.switchButton}
                onPress={handleCycleSubject}
                disabled={isIdentifying}
                activeOpacity={0.85}
                testID="cycle-subject"
              >
                <RefreshCw size={16} color={Colors.white} />
                <Text style={styles.switchButtonText}>Switch Face</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.frameContainer}>
              <View style={styles.frameCornerTL} />
              <View style={styles.frameCornerTR} />
              <View style={styles.frameCornerBL} />
              <View style={styles.frameCornerBR} />

              <View style={styles.subjectBadge}>
                <Camera size={14} color={Colors.white} />
                <Text style={styles.subjectBadgeText}>{selectedSubject?.label}</Text>
              </View>

              {isIdentifying && (
                <Animated.View
                  style={[
                    styles.scanLine,
                    {
                      transform: [
                        {
                          translateY: scanLineAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0, 200],
                          }),
                        },
                      ],
                    },
                  ]}
                />
              )}
            </View>

            <View style={styles.bottomArea}>
              {isIdentifying ? (
                <View style={styles.identifyingContainer}>
                  <Animated.View style={[styles.identifyingDot, { opacity: pulseAnim }]} />
                  <Text style={styles.identifyingText}>Sending to backend...</Text>
                  <Text style={styles.identifyingSubtext}>
                    Creating a session and running placeholder recognition
                  </Text>
                </View>
              ) : (
                <>
                  <Text style={styles.helperText}>
                    Demo mode: choose a face, then call the backend recognition endpoint.
                  </Text>
                  {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
                  <TouchableOpacity
                    style={styles.identifyButton}
                    onPress={handleIdentify}
                    activeOpacity={0.85}
                    testID="identify-button"
                  >
                    <Scan size={28} color={Colors.white} />
                    <Text style={styles.identifyButtonText}>Identify</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </Animated.View>
        </SafeAreaView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  cameraPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#1a1a2e',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 24,
  },
  previewAvatar: {
    width: 124,
    height: 124,
    borderRadius: 62,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewName: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: Colors.white,
    textAlign: 'center',
  },
  cameraPlaceholderText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 20,
    marginTop: 8,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  switchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  switchButtonText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '600' as const,
  },
  frameContainer: {
    flex: 1,
    marginHorizontal: 50,
    marginVertical: 40,
    maxHeight: 260,
    alignSelf: 'center',
    width: width - 100,
    position: 'relative',
  },
  frameCornerTL: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 40,
    height: 40,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderColor: 'rgba(255,255,255,0.6)',
    borderTopLeftRadius: 16,
  },
  frameCornerTR: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 40,
    height: 40,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderColor: 'rgba(255,255,255,0.6)',
    borderTopRightRadius: 16,
  },
  frameCornerBL: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: 40,
    height: 40,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderColor: 'rgba(255,255,255,0.6)',
    borderBottomLeftRadius: 16,
  },
  frameCornerBR: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 40,
    height: 40,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderColor: 'rgba(255,255,255,0.6)',
    borderBottomRightRadius: 16,
  },
  subjectBadge: {
    alignSelf: 'center',
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.28)',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  subjectBadgeText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '600' as const,
  },
  scanLine: {
    position: 'absolute',
    left: 10,
    right: 10,
    height: 2,
    backgroundColor: Colors.accent,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
  },
  bottomArea: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  helperText: {
    textAlign: 'center',
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    marginBottom: 12,
  },
  errorText: {
    textAlign: 'center',
    color: '#ffc6c6',
    fontSize: 13,
    marginBottom: 12,
  },
  identifyButton: {
    backgroundColor: Colors.accent,
    borderRadius: 24,
    paddingVertical: 22,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 6,
  },
  identifyButtonText: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: Colors.white,
  },
  identifyingContainer: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 20,
  },
  identifyingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.accent,
    marginBottom: 4,
  },
  identifyingText: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: Colors.white,
    textAlign: 'center',
  },
  identifyingSubtext: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
  },
});
