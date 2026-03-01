import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Heart, Shield, Lock } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';

const { width } = Dimensions.get('window');

export default function WelcomeScreen() {
  const router = useRouter();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const card1Anim = useRef(new Animated.Value(0)).current;
  const card2Anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
      Animated.stagger(150, [
        Animated.spring(card1Anim, {
          toValue: 1,
          tension: 50,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.spring(card2Anim, {
          toValue: 1,
          tension: 50,
          friction: 8,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, []);

  const handleCaregiver = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/caregiver/dashboard');
  };

  const handlePatient = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({ pathname: '/patient-pin', params: { source: 'mode-selection' } });
  };

  const handlePrivacy = () => {
    router.push('/modal');
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <Animated.View
          style={[
            styles.header,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <View style={styles.logoContainer}>
            <View style={styles.logoCircle}>
              <Heart size={32} color={Colors.white} fill={Colors.white} />
            </View>
          </View>
          <Text style={styles.title}>RememberMe</Text>
          <Text style={styles.subtitle}>
            Helping you recognize{'\n'}the people who matter most
          </Text>
        </Animated.View>

        <View style={styles.cardsContainer}>
          <Animated.View
            style={{
              opacity: card1Anim,
              transform: [
                {
                  translateY: card1Anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [40, 0],
                  }),
                },
              ],
            }}
          >
            <TouchableOpacity
              style={styles.card}
              onPress={handleCaregiver}
              activeOpacity={0.85}
              testID="caregiver-button"
            >
              <View style={styles.cardIconContainer}>
                <Shield size={28} color={Colors.accent} />
              </View>
              <View style={styles.cardContent}>
                <Text style={styles.cardTitle}>Caregiver Setup</Text>
                <Text style={styles.cardDescription}>
                  Set up profiles, add people, and manage preferences
                </Text>
              </View>
            </TouchableOpacity>
          </Animated.View>

          <Animated.View
            style={{
              opacity: card2Anim,
              transform: [
                {
                  translateY: card2Anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [40, 0],
                  }),
                },
              ],
            }}
          >
            <TouchableOpacity
              style={[styles.card, styles.patientCard]}
              onPress={handlePatient}
              activeOpacity={0.85}
              testID="patient-button"
            >
              <View style={[styles.cardIconContainer, styles.patientIconContainer]}>
                <Lock size={28} color={Colors.white} />
              </View>
              <View style={styles.cardContent}>
                <Text style={[styles.cardTitle, styles.patientCardTitle]}>
                  Patient Mode
                </Text>
                <Text style={[styles.cardDescription, styles.patientCardDescription]}>
                  Requires caregiver PIN
                </Text>
              </View>
            </TouchableOpacity>
          </Animated.View>
        </View>

        <TouchableOpacity
          style={styles.privacyLink}
          onPress={handlePrivacy}
          testID="privacy-link"
        >
          <Text style={styles.privacyText}>About privacy</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: 24,
  },
  header: {
    alignItems: 'center',
    marginTop: 60,
    marginBottom: 48,
  },
  logoContainer: {
    marginBottom: 20,
  },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  title: {
    fontSize: 34,
    fontWeight: '700' as const,
    color: Colors.text,
    letterSpacing: -0.5,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 17,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  cardsContainer: {
    gap: 16,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    shadowColor: Colors.cardShadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  patientCard: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accentDark,
  },
  cardIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: Colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  patientIconContainer: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 19,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 4,
  },
  patientCardTitle: {
    color: Colors.white,
  },
  cardDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  patientCardDescription: {
    color: 'rgba(255,255,255,0.8)',
  },
  privacyLink: {
    alignSelf: 'center',
    marginTop: 'auto' as const,
    marginBottom: 16,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  privacyText: {
    fontSize: 14,
    color: Colors.textTertiary,
    textDecorationLine: 'underline',
  },
});
