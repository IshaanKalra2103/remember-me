import React, { useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RotateCcw, HandHelping, ArrowLeft, Heart } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useApp } from '@/providers/AppProvider';

export default function PatientNotSureScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ handoff?: string }>();
  const { addActivityLogEntry, currentPatientId } = useApp();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [showHandoff, setShowHandoff] = React.useState<boolean>(false);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, []);

  const handleTryAgain = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.replace('/patient-recognize');
  };

  const handleAskHelp = useCallback(() => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (currentPatientId) {
      addActivityLogEntry({
        type: 'help_requested',
      }).catch((logErr) => {
        console.warn('Failed to record help request:', logErr);
      });
    }

    setShowHandoff(true);
  }, [addActivityLogEntry, currentPatientId]);

  useEffect(() => {
    if (params.handoff === 'true') {
      handleAskHelp();
    }
  }, [params.handoff, handleAskHelp]);

  const handleReturnToPIN = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.replace({
      pathname: '/patient-pin',
      params: { next: '/caregiver/dashboard' },
    });
  };

  const handleGoBack = () => {
    router.replace('/patient-home');
  };

  if (showHandoff) {
    return (
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <Animated.View style={[styles.handoffContent, { opacity: fadeAnim }]}>
            <View style={styles.handoffIcon}>
              <HandHelping size={48} color={Colors.accent} />
            </View>
            <Text style={styles.handoffTitle}>
              Please hand the phone{'\n'}to your caregiver
            </Text>
            <Text style={styles.handoffSubtext}>They can help from here</Text>
            <TouchableOpacity
              style={styles.returnButton}
              onPress={handleReturnToPIN}
              activeOpacity={0.85}
              testID="return-to-pin"
            >
              <ArrowLeft size={20} color={Colors.white} />
              <Text style={styles.returnButtonText}>Return to PIN Screen</Text>
            </TouchableOpacity>
          </Animated.View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
          <View style={styles.centerContent}>
            <View style={styles.iconContainer}>
              <Heart size={32} color={Colors.accent} />
            </View>
            <Text style={styles.title}>I'm not sure{'\n'}who this is</Text>
            <Text style={styles.subtitle}>That's okay. Let's try again.</Text>
          </View>

          <View style={styles.buttonsContainer}>
            <TouchableOpacity
              style={styles.tryAgainButton}
              onPress={handleTryAgain}
              activeOpacity={0.85}
              testID="try-again"
            >
              <RotateCcw size={24} color={Colors.white} />
              <Text style={styles.tryAgainText}>Try again</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.helpButton}
              onPress={handleAskHelp}
              activeOpacity={0.85}
              testID="ask-caregiver"
            >
              <HandHelping size={24} color={Colors.accent} />
              <Text style={styles.helpButtonText}>
                Ask caregiver for help
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.goBackLink}
              onPress={handleGoBack}
            >
              <Text style={styles.goBackText}>Go back home</Text>
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
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: '700' as const,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 40,
  },
  subtitle: {
    fontSize: 18,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  buttonsContainer: {
    gap: 12,
    paddingBottom: 24,
  },
  tryAgainButton: {
    backgroundColor: Colors.accent,
    borderRadius: 22,
    paddingVertical: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
  },
  tryAgainText: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.white,
  },
  helpButton: {
    backgroundColor: Colors.surface,
    borderRadius: 22,
    paddingVertical: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  helpButtonText: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.accent,
  },
  goBackLink: {
    alignSelf: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  goBackText: {
    fontSize: 15,
    color: Colors.textTertiary,
    textDecorationLine: 'underline',
  },
  handoffContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  handoffIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  handoffTitle: {
    fontSize: 26,
    fontWeight: '700' as const,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 34,
  },
  handoffSubtext: {
    fontSize: 17,
    color: Colors.textSecondary,
    marginBottom: 40,
  },
  returnButton: {
    backgroundColor: Colors.accent,
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  returnButtonText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.white,
  },
});
