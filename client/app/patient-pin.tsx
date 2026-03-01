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
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Delete, Lock } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import MainLoader from '@/components/MainLoader';
import { useApp } from '@/providers/AppProvider';
import { verifyPatientPin } from '@/utils/backendApi';

const { width } = Dimensions.get('window');
const KEY_SIZE = Math.min((width - 120) / 3, 80);

export default function PatientPinScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ next?: string }>();
  const { currentPatient, isLoading } = useApp();
  const [pin, setPin] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const nextRoute =
    typeof params.next === 'string' && params.next.startsWith('/')
      ? params.next
      : '/patient-home';

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, []);

  useEffect(() => {
    if (pin.length !== 4) {
      return;
    }

    const runVerify = async () => {
      if (!currentPatient) {
        setError('No patient selected.');
        return;
      }

      setIsVerifying(true);
      try {
        const valid = await verifyPatientPin(currentPatient.id, pin);
        if (valid) {
          if (Platform.OS !== 'web') {
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
          setTimeout(() => {
            router.replace(nextRoute as never);
          }, 200);
          return;
        }

        if (Platform.OS !== 'web') {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
        setError("That didn't match. Try again.");
        Animated.sequence([
          Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
        ]).start();
        setTimeout(() => setPin(''), 400);
      } catch (error) {
        console.error('[PatientPin] PIN verify failed:', error);
        setError('Could not verify PIN. Please try again.');
        setTimeout(() => setPin(''), 400);
      } finally {
        setIsVerifying(false);
      }
    };

    void runVerify();
  }, [currentPatient, pin, router, shakeAnim, nextRoute]);

  const handleKeyPress = (key: string) => {
    if (isVerifying) return;
    setError('');
    setPin((prev) => (prev.length < 4 ? `${prev}${key}` : prev));
  };

  const handleDelete = () => {
    if (isVerifying) return;
    setPin((prev) => prev.slice(0, -1));
    setError('');
  };

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'delete'];

  if (isLoading) {
    return (
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.content}>
            <MainLoader size={120} />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
          <View style={styles.header}>
            <View style={styles.lockCircle}>
              <Lock size={28} color={Colors.accent} />
            </View>
            <Text style={styles.title}>Enter PIN</Text>
            <Text style={styles.subtitle}>
              {currentPatient
                ? `Enter the PIN for ${currentPatient.name}`
                : 'Enter caregiver PIN to continue'}
            </Text>
          </View>

          <Animated.View
            style={[styles.dots, { transform: [{ translateX: shakeAnim }] }]}
          >
            {[0, 1, 2, 3].map((i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  i < pin.length && styles.dotFilled,
                  error !== '' && i < pin.length && styles.dotError,
                ]}
              />
            ))}
          </Animated.View>

          {isVerifying && <Text style={styles.verifyingText}>Verifying...</Text>}
          {error !== '' && <Text style={styles.errorText}>{error}</Text>}

          <View style={styles.keypad}>
            {keys.map((key, index) => {
              if (key === '') {
                return <View key={index} style={styles.keyEmpty} />;
              }
              if (key === 'delete') {
                return (
                  <TouchableOpacity
                    key={index}
                    style={styles.key}
                    onPress={handleDelete}
                    activeOpacity={0.7}
                    disabled={isVerifying}
                    testID="pin-delete"
                  >
                    <Delete size={24} color={Colors.text} />
                  </TouchableOpacity>
                );
              }
              return (
                <TouchableOpacity
                  key={index}
                  style={styles.key}
                  onPress={() => handleKeyPress(key)}
                  activeOpacity={0.7}
                  disabled={isVerifying}
                  testID={`pin-key-${key}`}
                >
                  <Text style={styles.keyText}>{key}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            style={styles.backLink}
            onPress={() => router.back()}
            disabled={isVerifying}
          >
            <Text style={styles.backLinkText}>Back to home</Text>
          </TouchableOpacity>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.patientBg,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  lockCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  dots: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.pinDot,
  },
  dotFilled: {
    backgroundColor: Colors.pinDotFilled,
  },
  dotError: {
    backgroundColor: Colors.destructive,
  },
  errorText: {
    fontSize: 14,
    color: Colors.destructive,
    marginBottom: 8,
    fontWeight: '500' as const,
  },
  verifyingText: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 8,
    fontWeight: '500' as const,
  },
  keypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 16,
    marginTop: 24,
    maxWidth: KEY_SIZE * 3 + 32,
  },
  key: {
    width: KEY_SIZE,
    height: KEY_SIZE,
    borderRadius: KEY_SIZE / 2,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.cardShadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
  },
  keyEmpty: {
    width: KEY_SIZE,
    height: KEY_SIZE,
  },
  keyText: {
    fontSize: 28,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  backLink: {
    marginTop: 32,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  backLinkText: {
    fontSize: 15,
    color: Colors.textTertiary,
    textDecorationLine: 'underline',
  },
});
