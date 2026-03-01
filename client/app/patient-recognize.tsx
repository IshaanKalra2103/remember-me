import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { ArrowLeft, Scan } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import Colors from '@/constants/colors';
import RecognitionResultModal from '@/components/RecognitionResultModal';
import { useApp } from '@/providers/AppProvider';
import { Person } from '@/types';
import {
  createRecognitionSession,
  getRecognitionPatientId,
  submitRecognitionFrame,
} from '@/utils/recognitionApi';
import { uploadMemory } from '@/utils/backendApi';

const { height: screenHeight } = Dimensions.get('window');

export default function PatientRecognizeScreen() {
  const router = useRouter();
  const { currentPeople, addActivityLogEntry, currentPatientId, setLastRecognition, preferences } = useApp();
  const [isIdentifying, setIsIdentifying] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [showResultModal, setShowResultModal] = useState<boolean>(false);
  const [recognizedPerson, setRecognizedPerson] = useState<Person | null>(null);
  const [resultConfidenceBand, setResultConfidenceBand] = useState<'high' | 'medium' | 'low'>('medium');
  const cameraRef = useRef<CameraView>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const recordingMetaRef = useRef<{
    patientId: string;
    personId: string;
    personName: string;
  } | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0.6)).current;
  const scanLineAnim = useRef(new Animated.Value(0)).current;

  const stopRecording = useCallback(async (upload = true) => {
    const recording = recordingRef.current;
    const meta = recordingMetaRef.current;
    recordingRef.current = null;
    recordingMetaRef.current = null;

    if (!recording) {
      return;
    }

    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();

      if (upload && uri && meta) {
        await uploadMemory(meta.patientId, meta.personId, meta.personName, uri);
      }
    } catch (error) {
      console.warn('[PatientRecognize] Failed to stop/upload recording:', error);
    } finally {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      }).catch(() => {});
    }
  }, []);

  const startRecording = useCallback(
    async (person: Person) => {
      if (!currentPatientId) {
        return;
      }

      try {
        const permissionResult = await Audio.requestPermissionsAsync();
        if (!permissionResult.granted) {
          console.warn('[PatientRecognize] Microphone permission denied');
          return;
        }

        await stopRecording(false);

        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
          shouldDuckAndroid: true,
          staysActiveInBackground: false,
        });

        const { recording } = await Audio.Recording.createAsync(
          Audio.RecordingOptionsPresets.HIGH_QUALITY
        );

        recordingRef.current = recording;
        recordingMetaRef.current = {
          patientId: currentPatientId,
          personId: person.id,
          personName: person.name,
        };
      } catch (error) {
        console.warn('[PatientRecognize] Failed to start recording:', error);
      }
    },
    [currentPatientId, stopRecording]
  );

  useEffect(() => {
    return () => {
      void stopRecording(false);
    };
  }, [stopRecording]);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  useEffect(() => {
    if (!isIdentifying) {
      return undefined;
    }

    const scanAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(scanLineAnim, {
          toValue: 1,
          duration: 1400,
          useNativeDriver: true,
        }),
        Animated.timing(scanLineAnim, {
          toValue: 0,
          duration: 1400,
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

    return () => {
      scanAnimation.stop();
      pulseAnimation.stop();
    };
  }, [isIdentifying, pulseAnim, scanLineAnim]);

  const handleIdentify = async () => {
    if (!currentPeople.length) {
      router.replace('/patient-not-sure');
      return;
    }

    if (!permission?.granted) {
      const next = await requestPermission();
      if (!next.granted) {
        setErrorMessage('Camera permission is required.');
        return;
      }
    }

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    setErrorMessage(null);
    setIsIdentifying(true);

    try {
      const patientId = getRecognitionPatientId(currentPatientId);
      if (!patientId) {
        throw new Error('Set EXPO_PUBLIC_PATIENT_ID or create a real patient first.');
      }

      const session = await createRecognitionSession(patientId);
      const photo = await cameraRef.current?.takePictureAsync({
        quality: 0.5,
        shutterSound: false,
      });

      if (!photo?.uri || !photo.width || !photo.height) {
        throw new Error('Camera capture failed.');
      }

      const result = await submitRecognitionFrame(session.id, photo.uri);

      const topCandidate = result.candidates[0];
      const resolvedPerson =
        (result.winnerPersonId &&
          currentPeople.find((person) => person.id === result.winnerPersonId)) ||
        (topCandidate &&
          currentPeople.find(
            (person) => person.id === topCandidate.personId || person.name === topCandidate.name
          )) ||
        null;

      if (result.status === 'not_sure' || !resolvedPerson) {
        setLastRecognition(null);

        if (currentPatientId) {
          addActivityLogEntry({
            patientId: currentPatientId,
            type: 'unsure',
            confidence: result.confidenceScore ?? undefined,
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
          confidence: result.confidenceScore ?? undefined,
          note: `Backend status: ${result.status}`,
        });
      }

      setRecognizedPerson(resolvedPerson);
      setResultConfidenceBand(result.confidenceBand ?? 'medium');
      setShowResultModal(true);
      void startRecording(resolvedPerson);
    } catch (error) {
      console.error('[PatientRecognize] Recognition error:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Recognition failed');
      setLastRecognition(null);
    } finally {
      setIsIdentifying(false);
    }
  };

  const handleModalClose = () => {
    setShowResultModal(false);
    setRecognizedPerson(null);
    router.replace('/patient-home');
  };

  const handleModalNotCorrect = () => {
    if (currentPatientId && recognizedPerson) {
      addActivityLogEntry({
        patientId: currentPatientId,
        type: 'not_correct',
        personName: recognizedPerson.name,
      });
    }

    setShowResultModal(false);
    setRecognizedPerson(null);
    router.replace('/patient-not-sure');
  };

  const handleAnnouncementPlayed = () => {
    if (!currentPatientId) {
      return;
    }

    addActivityLogEntry({
      patientId: currentPatientId,
      type: 'audio_played',
      personName: recognizedPerson?.name,
    });
  };

  const handleStopRecording = () => {
    void stopRecording(true);
  };

  if (!permission?.granted) {
    return (
      <View style={styles.container}>
        <View style={styles.permissionContainer}>
          <Text style={styles.permissionTitle}>Camera Access Needed</Text>
          <Text style={styles.permissionText}>
            To recognize people in front of you, we need camera access.
          </Text>
          <TouchableOpacity
            style={styles.permissionButton}
            onPress={() => requestPermission()}
            activeOpacity={0.85}
          >
            <Text style={styles.permissionButtonText}>Enable Camera</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={styles.camera} facing="front" />

      <LinearGradient
        colors={['rgba(5,8,18,0.65)', 'rgba(5,8,18,0.1)', 'rgba(5,8,18,0.8)']}
        style={styles.overlay}
      >
        <SafeAreaView style={styles.safeArea}>
          <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
            <View style={styles.headerRow}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => router.back()}
                testID="recognize-back"
                disabled={showResultModal}
              >
                <ArrowLeft size={24} color={Colors.white} />
              </TouchableOpacity>

              <View style={styles.headerBadge}>
                <Text style={styles.headerBadgeText}>Live Recognition</Text>
              </View>
            </View>

            <View style={styles.frameContainer}>
              {isIdentifying && (
                <Animated.View
                  style={[
                    styles.scanLine,
                    {
                      transform: [
                        {
                          translateY: scanLineAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0, screenHeight * 0.4],
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
                  <Text style={styles.identifyingText}>Analyzing live frame...</Text>
                  <Text style={styles.identifyingSubtext}>Securing a match in the cloud</Text>
                </View>
              ) : (
                <>
                  <Text style={styles.helperText}>
                    Hold the camera steady and tap identify to recognize the closest face.
                  </Text>
                  {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
                  <TouchableOpacity
                    style={styles.identifyButton}
                    onPress={handleIdentify}
                    activeOpacity={0.85}
                    disabled={showResultModal}
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
      </LinearGradient>

      <RecognitionResultModal
        visible={showResultModal}
        person={recognizedPerson}
        confidenceBand={resultConfidenceBand}
        preferences={preferences}
        onClose={handleModalClose}
        onRepeat={handleAnnouncementPlayed}
        onNotCorrect={handleModalNotCorrect}
        onStopRecording={handleStopRecording}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#070a14',
  },
  camera: {
    flex: 1,
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
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(5,8,18,0.6)',
  },
  headerBadgeText: {
    color: Colors.white,
    fontSize: 13,
    fontWeight: '600' as const,
  },
  frameContainer: {
    flex: 1,
    marginHorizontal: 16,
    marginVertical: 20,
    position: 'relative',
  },
  scanLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: Colors.accent,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
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
  },
  identifyingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.accent,
  },
  identifyingText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600' as const,
  },
  identifyingSubtext: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
  },
  permissionContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  permissionTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: Colors.white,
    marginBottom: 12,
  },
  permissionText: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    marginBottom: 20,
  },
  permissionButton: {
    backgroundColor: Colors.accent,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 20,
  },
  permissionButtonText: {
    color: Colors.white,
    fontWeight: '600' as const,
  },
});
