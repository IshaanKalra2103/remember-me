import React, { useState, useRef, useEffect } from 'react';
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
import { Camera, Scan, ArrowLeft } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useApp } from '@/providers/AppProvider';

const { width, height } = Dimensions.get('window');

export default function PatientRecognizeScreen() {
  const router = useRouter();
  const { currentPeople, addActivityLogEntry, currentPatientId, setLastRecognition } = useApp();
  const [isIdentifying, setIsIdentifying] = useState<boolean>(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0.6)).current;
  const scanLineAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, []);

  useEffect(() => {
    if (isIdentifying) {
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

      const timer = setTimeout(() => {
        if (currentPeople.length > 0) {
          const randomPerson =
            currentPeople[Math.floor(Math.random() * currentPeople.length)];
          const isConfident = Math.random() > 0.3;

          setLastRecognition(randomPerson);

          if (currentPatientId) {
            addActivityLogEntry({
              patientId: currentPatientId,
              type: 'identified',
              personName: randomPerson.name,
              confidence: isConfident ? 'high' : 'low',
            });
          }

          if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

          router.replace({
            pathname: '/patient-result',
            params: {
              personId: randomPerson.id,
              confident: isConfident ? 'true' : 'false',
            },
          });
        } else {
          router.replace('/patient-not-sure');
        }
      }, 2500);

      return () => {
        clearTimeout(timer);
        scanAnimation.stop();
        pulseAnimation.stop();
      };
    }
  }, [isIdentifying]);

  const handleIdentify = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsIdentifying(true);
  };

  return (
    <View style={styles.container}>
      <View style={styles.cameraPlaceholder}>
        <Camera size={48} color="rgba(255,255,255,0.3)" />
        <Text style={styles.cameraPlaceholderText}>Camera View</Text>
      </View>

      <View style={styles.overlay}>
        <SafeAreaView style={styles.safeArea}>
          <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
              testID="recognize-back"
            >
              <ArrowLeft size={24} color={Colors.white} />
            </TouchableOpacity>

            <View style={styles.frameContainer}>
              <View style={styles.frameCornerTL} />
              <View style={styles.frameCornerTR} />
              <View style={styles.frameCornerBL} />
              <View style={styles.frameCornerBR} />

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
                  <Text style={styles.identifyingText}>Identifying...</Text>
                  <Text style={styles.identifyingSubtext}>
                    Hold still for a moment
                  </Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.identifyButton}
                  onPress={handleIdentify}
                  activeOpacity={0.85}
                  testID="identify-button"
                >
                  <Scan size={28} color={Colors.white} />
                  <Text style={styles.identifyButtonText}>Identify</Text>
                </TouchableOpacity>
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
    gap: 12,
  },
  cameraPlaceholderText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.3)',
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
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 20,
    marginTop: 8,
  },
  frameContainer: {
    flex: 1,
    marginHorizontal: 50,
    marginVertical: 40,
    maxHeight: 260,
    alignSelf: 'center',
    width: width - 100,
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
  },
  identifyingSubtext: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.6)',
  },
});
