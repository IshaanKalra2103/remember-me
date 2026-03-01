import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Animated,
  Platform,
  Switch,
  KeyboardAvoidingView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Check, ChevronRight, User, Settings } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useApp } from '@/providers/AppProvider';
import { Patient } from '@/types';

export default function AddPatientScreen() {
  const router = useRouter();
  const { addPatient } = useApp();
  const [step, setStep] = useState<number>(0);
  const [name, setName] = useState<string>('');
  const [language, setLanguage] = useState<string>('English');
  const [supervisionMode, setSupervisionMode] = useState<boolean>(true);
  const [autoPlayAudio, setAutoPlayAudio] = useState<boolean>(true);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const steps = [
    { title: 'Basics', icon: <User size={20} color={Colors.accent} /> },
    { title: 'Preferences', icon: <Settings size={20} color={Colors.accent} /> },
  ];

  const animateTransition = (callback: () => void) => {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
    ]).start();
    setTimeout(callback, 150);
  };

  const handleNext = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (step < 1) {
      animateTransition(() => setStep(step + 1));
      return;
    }

    const newPatientId = `patient-${Date.now()}`;
    const newPatient: Patient = {
      id: newPatientId,
      name: name.trim(),
      language,
      supervisionMode,
      autoPlayAudio,
      createdAt: new Date().toISOString(),
    };

    addPatient(newPatient);
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    animateTransition(() => setStep(2));
  };

  const canProceed = () => {
    if (step === 0) return name.trim().length > 0;
    return true;
  };

  const renderStepIndicator = () => (
    <View style={styles.stepIndicator}>
      {steps.map((s, i) => (
        <View key={i} style={styles.stepItem}>
          <View
            style={[
              styles.stepDot,
              i <= step && styles.stepDotActive,
              i < step && styles.stepDotComplete,
            ]}
          >
            {i < step ? (
              <Check size={12} color={Colors.white} />
            ) : (
              <Text style={[styles.stepNumber, i <= step && styles.stepNumberActive]}>
                {i + 1}
              </Text>
            )}
          </View>
          <Text style={[styles.stepLabel, i <= step && styles.stepLabelActive]}>
            {s.title}
          </Text>
        </View>
      ))}
    </View>
  );

  if (step === 2) {
    return (
      <View style={styles.container}>
        <View style={styles.successContainer}>
          <View style={styles.successCircle}>
            <Check size={40} color={Colors.white} />
          </View>
          <Text style={styles.successTitle}>Patient Created</Text>
          <Text style={styles.successMessage}>
            {name} is all set up.{"\n"}Next, add the people they know.
          </Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.push('/caregiver/manage-people')}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryButtonText}>Add People</Text>
            <ChevronRight size={18} color={Colors.white} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => router.back()}
          >
            <Text style={styles.secondaryButtonText}>Back to Dashboard</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {renderStepIndicator()}

        <Animated.View style={[styles.formContainer, { opacity: fadeAnim }]}>
          {step === 0 && (
            <View>
              <Text style={styles.stepTitle}>Patient Basics</Text>
              <Text style={styles.stepDescription}>
                Enter the patient name and preferred language.
              </Text>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Patient Name</Text>
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="e.g. Margaret"
                  placeholderTextColor={Colors.textTertiary}
                  autoFocus
                  testID="patient-name-input"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Preferred Language (optional)</Text>
                <TextInput
                  style={styles.input}
                  value={language}
                  onChangeText={setLanguage}
                  placeholder="e.g. English"
                  placeholderTextColor={Colors.textTertiary}
                  testID="language-input"
                />
              </View>
            </View>
          )}

          {step === 1 && (
            <View>
              <Text style={styles.stepTitle}>Supervision Preferences</Text>
              <Text style={styles.stepDescription}>
                Choose how RememberMe should behave during patient use.
              </Text>
              <View style={styles.toggleRow}>
                <View style={styles.toggleInfo}>
                  <Text style={styles.toggleLabel}>Supervision Mode</Text>
                  <Text style={styles.toggleDescription}>
                    Log all recognition attempts (recommended)
                  </Text>
                </View>
                <Switch
                  value={supervisionMode}
                  onValueChange={setSupervisionMode}
                  trackColor={{ false: Colors.border, true: Colors.accent }}
                  thumbColor={Colors.white}
                />
              </View>
              <View style={styles.toggleRow}>
                <View style={styles.toggleInfo}>
                  <Text style={styles.toggleLabel}>Auto-play Audio</Text>
                  <Text style={styles.toggleDescription}>
                    Speak the announcement immediately after recognition
                  </Text>
                </View>
                <Switch
                  value={autoPlayAudio}
                  onValueChange={setAutoPlayAudio}
                  trackColor={{ false: Colors.border, true: Colors.accent }}
                  thumbColor={Colors.white}
                />
              </View>
            </View>
          )}
        </Animated.View>

        <TouchableOpacity
          style={[styles.primaryButton, !canProceed() && styles.buttonDisabled]}
          onPress={handleNext}
          disabled={!canProceed()}
          activeOpacity={0.85}
          testID="next-button"
        >
          <Text style={styles.primaryButtonText}>
            {step === 1 ? 'Create Patient' : 'Continue'}
          </Text>
          <ChevronRight size={18} color={Colors.white} />
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 32,
    marginBottom: 32,
    marginTop: 8,
  },
  stepItem: {
    alignItems: 'center',
    gap: 6,
  },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.border,
  },
  stepDotActive: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accentLight,
  },
  stepDotComplete: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  stepNumber: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textTertiary,
  },
  stepNumberActive: {
    color: Colors.accent,
  },
  stepLabel: {
    fontSize: 12,
    color: Colors.textTertiary,
    fontWeight: '500' as const,
  },
  stepLabelActive: {
    color: Colors.accent,
  },
  formContainer: {
    marginBottom: 32,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 8,
  },
  stepDescription: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 22,
    marginBottom: 28,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    fontSize: 16,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  toggleInfo: {
    flex: 1,
    marginRight: 12,
  },
  toggleLabel: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 2,
  },
  toggleDescription: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  primaryButton: {
    backgroundColor: Colors.accent,
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  successCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 12,
  },
  successMessage: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 36,
  },
  secondaryButton: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    marginTop: 12,
  },
  secondaryButtonText: {
    fontSize: 15,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },
});
