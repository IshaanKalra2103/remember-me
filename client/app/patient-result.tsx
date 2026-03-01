import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RotateCcw, XCircle, Volume2, Square, Check, X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useApp } from '@/providers/AppProvider';

export default function PatientResultScreen() {
  const router = useRouter();
  const { personId, confident, confidenceBand, repeat } = useLocalSearchParams<{
    personId: string;
    confident?: string;
    confidenceBand?: 'high' | 'medium' | 'low';
    repeat?: string;
  }>();
  const { people, preferences, addActivityLogEntry, currentPatientId } = useApp();
  const person = people.find((p) => p.id === personId);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const nameAnim = useRef(new Animated.Value(0)).current;
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [showConfirm, setShowConfirm] = useState<boolean>(false);
  const resolvedConfidence =
    confidenceBand ?? (confident === 'true' ? 'high' : confident === 'false' ? 'low' : 'medium');
  const isConfident = resolvedConfidence === 'high';

  useEffect(() => {
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(nameAnim, {
        toValue: 1,
        tension: 40,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();

    const shouldConfirm =
      preferences.confirmBehavior === 'always' ||
      (preferences.confirmBehavior === 'when_unsure' && !isConfident);

    if (shouldConfirm && repeat !== 'true') {
      setShowConfirm(true);
    } else {
      startSpeaking();
    }
  }, []);

  const startSpeaking = () => {
    setShowConfirm(false);
    setIsSpeaking(true);
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (currentPatientId) {
      addActivityLogEntry({
        patientId: currentPatientId,
        type: 'audio_played',
        personName: person?.name,
      });
    }

    setTimeout(() => {
      setIsSpeaking(false);
    }, 3000);
  };

  const handleRepeat = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    startSpeaking();
  };

  const handleNotCorrect = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsSpeaking(false);

    if (currentPatientId) {
      addActivityLogEntry({
        patientId: currentPatientId,
        type: 'not_correct',
        personName: person?.name,
      });
    }

    router.replace('/patient-not-sure');
  };

  const handleConfirmYes = () => {
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    startSpeaking();
  };

  const handleConfirmNo = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.replace('/patient-not-sure');
  };

  const handleStop = () => {
    setIsSpeaking(false);
  };

  if (!person) {
    return (
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.centerContent}>
            <Text style={styles.errorText}>Something went wrong</Text>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.replace('/patient-home')}
            >
              <Text style={styles.backButtonText}>Go back</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const relationLabel = person.relationship
    ? person.relationship.charAt(0).toUpperCase() + person.relationship.slice(1)
    : 'Someone you know';

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
          {isSpeaking && (
            <View style={styles.speakingBadge}>
              <Volume2 size={16} color={Colors.accent} />
              <Text style={styles.speakingText}>Speaking...</Text>
              <TouchableOpacity onPress={handleStop} style={styles.stopButton}>
                <Square size={12} color={Colors.textSecondary} fill={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.centerContent}>
            {showConfirm ? (
              <View style={styles.confirmContainer}>
                <Animated.View
                  style={{
                    transform: [
                      {
                        scale: nameAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.8, 1],
                        }),
                      },
                    ],
                  }}
                >
                  <Text style={styles.confirmQuestion}>Is this</Text>
                  <Text style={styles.nameText}>{person.name}?</Text>
                </Animated.View>

                <View style={styles.confirmButtons}>
                  <TouchableOpacity
                    style={styles.confirmYes}
                    onPress={handleConfirmYes}
                    activeOpacity={0.85}
                    testID="confirm-yes"
                  >
                    <Check size={32} color={Colors.white} />
                    <Text style={styles.confirmYesText}>Yes</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.confirmNo}
                    onPress={handleConfirmNo}
                    activeOpacity={0.85}
                    testID="confirm-no"
                  >
                    <X size={32} color={Colors.destructive} />
                    <Text style={styles.confirmNoText}>No</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.resultContainer}>
                <View style={styles.avatarLarge}>
                  <Text style={styles.avatarLargeText}>
                    {person.name.charAt(0)}
                  </Text>
                </View>

                <Animated.View
                  style={{
                    alignItems: 'center',
                    transform: [
                      {
                        scale: nameAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.8, 1],
                        }),
                      },
                    ],
                  }}
                >
                  {preferences.showLargeName && (
                    <Text style={styles.nameText}>This is {person.name}</Text>
                  )}
                  {preferences.showRelationship && (
                    <Text style={styles.relationText}>Your {relationLabel}</Text>
                  )}
                </Animated.View>

                <View style={styles.confidenceBadge}>
                  <Text
                    style={[
                      styles.confidenceText,
                      resolvedConfidence !== 'high' && styles.confidenceTextLow,
                    ]}
                  >
                    {resolvedConfidence === 'high'
                      ? 'Confident'
                      : resolvedConfidence === 'medium'
                        ? 'Needs confirmation'
                        : 'Not sure'}
                  </Text>
                </View>
              </View>
            )}
          </View>

          {!showConfirm && (
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={styles.repeatButton}
                onPress={handleRepeat}
                activeOpacity={0.85}
                testID="repeat-button"
              >
                <RotateCcw size={22} color={Colors.accent} />
                <Text style={styles.repeatButtonText}>Repeat</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.notCorrectButton}
                onPress={handleNotCorrect}
                activeOpacity={0.85}
                testID="not-correct-button"
              >
                <XCircle size={22} color={Colors.destructive} />
                <Text style={styles.notCorrectButtonText}>Not correct</Text>
              </TouchableOpacity>
            </View>
          )}
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
  speakingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 8,
    backgroundColor: Colors.accentLight,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginTop: 12,
  },
  speakingText: {
    fontSize: 15,
    color: Colors.accent,
    fontWeight: '600' as const,
  },
  stopButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultContainer: {
    alignItems: 'center',
    gap: 16,
  },
  avatarLarge: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  avatarLargeText: {
    fontSize: 42,
    fontWeight: '600' as const,
    color: Colors.accent,
  },
  nameText: {
    fontSize: 36,
    fontWeight: '700' as const,
    color: Colors.text,
    textAlign: 'center',
  },
  relationText: {
    fontSize: 22,
    color: Colors.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
  confidenceBadge: {
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: Colors.surface,
  },
  confidenceText: {
    fontSize: 14,
    color: Colors.success,
    fontWeight: '600' as const,
  },
  confidenceTextLow: {
    color: Colors.warning,
  },
  confirmContainer: {
    alignItems: 'center',
    gap: 40,
  },
  confirmQuestion: {
    fontSize: 22,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 4,
  },
  confirmButtons: {
    flexDirection: 'row',
    gap: 20,
  },
  confirmYes: {
    width: 120,
    height: 120,
    borderRadius: 28,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
  },
  confirmYesText: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.white,
  },
  confirmNo: {
    width: 120,
    height: 120,
    borderRadius: 28,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 2,
    borderColor: Colors.border,
  },
  confirmNoText: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.destructive,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    paddingBottom: 24,
  },
  repeatButton: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 20,
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  repeatButtonText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.accent,
  },
  notCorrectButton: {
    flex: 1,
    backgroundColor: Colors.destructiveLight,
    borderRadius: 20,
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  notCorrectButtonText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.destructive,
  },
  errorText: {
    fontSize: 18,
    color: Colors.textSecondary,
    marginBottom: 20,
  },
  backButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  backButtonText: {
    fontSize: 16,
    color: Colors.accent,
    fontWeight: '600' as const,
  },
});
