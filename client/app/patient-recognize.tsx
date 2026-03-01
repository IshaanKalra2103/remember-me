import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
  Dimensions,
  LayoutChangeEvent,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Scan, ShieldCheck, ShieldAlert } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import Colors from '@/constants/colors';
import { useApp } from '@/providers/AppProvider';
import {
  createRecognitionSession,
  getRecognitionPatientId,
  submitRecognitionFrame,
} from '@/utils/recognitionApi';

const { height: screenHeight } = Dimensions.get('window');

type BBox = { x: number; y: number; w: number; h: number };

type OverlayBox = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export default function PatientRecognizeScreen() {
  const router = useRouter();
  const { currentPeople, addActivityLogEntry, currentPatientId, setLastRecognition } = useApp();
  const [isIdentifying, setIsIdentifying] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [bbox, setBbox] = useState<OverlayBox | null>(null);
  const [recognizedName, setRecognizedName] = useState<string | null>(null);
  const [confidenceBand, setConfidenceBand] = useState<'high' | 'medium' | 'low' | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0.6)).current;
  const scanLineAnim = useRef(new Animated.Value(0)).current;
  const previewLayout = useRef<{ width: number; height: number } | null>(null);

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

  const getOverlayBox = (photoWidth: number, photoHeight: number, box: BBox) => {
    const layout = previewLayout.current;
    if (!layout) {
      return null;
    }

    const scale = Math.max(layout.width / photoWidth, layout.height / photoHeight);
    const displayWidth = photoWidth * scale;
    const displayHeight = photoHeight * scale;
    const offsetX = (layout.width - displayWidth) / 2;
    const offsetY = (layout.height - displayHeight) / 2;

    return {
      left: box.x * scale + offsetX,
      top: box.y * scale + offsetY,
      width: box.w * scale,
      height: box.h * scale,
    };
  };

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    previewLayout.current = { width, height };
  };

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
    setBbox(null);
    setRecognizedName(null);
    setConfidenceBand(null);

    try {
      const patientId = getRecognitionPatientId(currentPatientId);
      if (!patientId) {
        throw new Error('Set EXPO_PUBLIC_PATIENT_ID or create a real patient first.');
      }

      const session = await createRecognitionSession(patientId);
      const photo = await cameraRef.current?.takePictureAsync({
        quality: 0.5,
        skipProcessing: true,
      });

      if (!photo?.uri || !photo.width || !photo.height) {
        throw new Error('Camera capture failed.');
      }

      const result = await submitRecognitionFrame(session.id, photo.uri);
      const overlay = result.primaryBbox
        ? getOverlayBox(photo.width, photo.height, result.primaryBbox)
        : null;

      if (overlay) {
        setBbox(overlay);
      }
      setRecognizedName(result.recognizedName ?? null);
      setConfidenceBand(result.confidenceBand ?? null);

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

        setTimeout(() => router.replace('/patient-not-sure'), 600);
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

      setTimeout(() => {
        router.replace({
          pathname: '/patient-result',
          params: {
            personId: resolvedPerson.id,
            confidenceBand: result.confidenceBand ?? 'medium',
          },
        });
      }, 600);
    } catch (error) {
      console.error('[PatientRecognize] Recognition error:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Recognition failed');
      setLastRecognition(null);
    } finally {
      setIsIdentifying(false);
    }
  };

  const overlayColor = useMemo(() => {
    if (confidenceBand === 'high') return '#2ecc71';
    if (confidenceBand === 'medium') return '#f5c542';
    if (confidenceBand === 'low') return '#f06265';
    return 'rgba(255,255,255,0.5)';
  }, [confidenceBand]);

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
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing="front"
        onLayout={handleLayout}
      />

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
              >
                <ArrowLeft size={24} color={Colors.white} />
              </TouchableOpacity>

              <View style={styles.headerBadge}>
                {confidenceBand === 'high' ? (
                  <ShieldCheck size={16} color={overlayColor} />
                ) : (
                  <ShieldAlert size={16} color={overlayColor} />
                )}
                <Text style={styles.headerBadgeText}>Live Recognition</Text>
              </View>
            </View>

            <View style={styles.frameContainer}>
              {bbox && (
                <View
                  style={[
                    styles.boundingBox,
                    {
                      left: bbox.left,
                      top: bbox.top,
                      width: bbox.width,
                      height: bbox.height,
                      borderColor: overlayColor,
                    },
                  ]}
                >
                  {recognizedName && (
                    <View style={[styles.namePill, { borderColor: overlayColor }]}> 
                      <Text style={styles.nameText}>{recognizedName}</Text>
                    </View>
                  )}
                </View>
              )}

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
  boundingBox: {
    position: 'absolute',
    borderWidth: 2,
    borderRadius: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
  },
  namePill: {
    position: 'absolute',
    top: -30,
    left: 0,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(5,8,18,0.8)',
    borderWidth: 1,
  },
  nameText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '600' as const,
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
