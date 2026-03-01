import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Eye, RotateCcw, HandHelping, Settings, Heart } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useApp } from '@/providers/AppProvider';

export default function PatientHomeScreen() {
  const router = useRouter();
  const { lastRecognizedPerson, currentPatient } = useApp();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const [statusText, setStatusText] = useState<string>('Ready');

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  const handleWhoIsHere = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/patient-recognize');
  };

  const handleRepeat = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (lastRecognizedPerson) {
      router.push({
        pathname: '/patient-result',
        params: { personId: lastRecognizedPerson.id, repeat: 'true' },
      });
    }
  };

  const handleHelp = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    router.push({ pathname: '/patient-not-sure', params: { handoff: 'true' } });
  };

  const handleSettings = () => {
    router.push({ pathname: '/patient-pin', params: { next: 'caregiver', source: 'patient-home' } });
  };

  const handleBackToModeSelection = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.replace('/');
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
          <View style={styles.topBar}>
            <View style={styles.statusBadge}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>{statusText}</Text>
            </View>
            <TouchableOpacity
              style={styles.settingsButton}
              onPress={handleSettings}
              testID="patient-settings"
            >
              <Settings size={20} color={Colors.textTertiary} />
            </TouchableOpacity>
          </View>

          <View style={styles.centerContent}>
            <View style={styles.greetingContainer}>
              <Heart size={24} color={Colors.accent} fill={Colors.accent} />
              <Text style={styles.greeting}>
                {currentPatient ? `Hi, ${currentPatient.name}` : 'Hello'}
              </Text>
              <Text style={styles.greetingSubtext}>You're doing great</Text>
            </View>
          </View>

          <View style={styles.buttonsContainer}>
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <TouchableOpacity
                style={styles.mainButton}
                onPress={handleWhoIsHere}
                activeOpacity={0.85}
                testID="who-is-here"
              >
                <Eye size={36} color={Colors.white} />
                <Text style={styles.mainButtonText}>Who is here?</Text>
              </TouchableOpacity>
            </Animated.View>

            <View style={styles.secondaryButtons}>
              <TouchableOpacity
                style={[
                  styles.secondaryButton,
                  !lastRecognizedPerson && styles.buttonDisabled,
                ]}
                onPress={handleRepeat}
                disabled={!lastRecognizedPerson}
                activeOpacity={0.85}
                testID="repeat-last"
              >
                <RotateCcw size={24} color={Colors.accent} />
                <Text style={styles.secondaryButtonText}>Repeat last</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={handleHelp}
                activeOpacity={0.85}
                testID="ask-help"
              >
                <HandHelping size={24} color={Colors.accent} />
                <Text style={styles.secondaryButtonText}>Ask caregiver{'\n'}for help</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={styles.modeBackLink}
              onPress={handleBackToModeSelection}
              testID="back-to-mode-selection"
            >
              <Text style={styles.modeBackLinkText}>Back to mode selection</Text>
            </TouchableOpacity>
          </View>
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
    paddingHorizontal: 24,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 20,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.success,
  },
  statusText: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  greetingContainer: {
    alignItems: 'center',
    gap: 12,
  },
  greeting: {
    fontSize: 36,
    fontWeight: '700' as const,
    color: Colors.text,
    textAlign: 'center',
  },
  greetingSubtext: {
    fontSize: 18,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  buttonsContainer: {
    gap: 16,
    paddingBottom: 24,
  },
  mainButton: {
    backgroundColor: Colors.accent,
    borderRadius: 24,
    paddingVertical: 28,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 6,
  },
  mainButtonText: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.white,
  },
  secondaryButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modeBackLink: {
    marginTop: 6,
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  modeBackLinkText: {
    fontSize: 15,
    color: Colors.textTertiary,
    textDecorationLine: 'underline',
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 20,
    paddingVertical: 22,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
    textAlign: 'center',
  },
});
