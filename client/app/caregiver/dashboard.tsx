import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Platform,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  UserPlus,
  Users,
  Settings,
  ClipboardList,
  Play,
  ChevronRight,
  LogOut,
  Heart,
  RefreshCw,
  Mic,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useApp } from '@/providers/AppProvider';

interface DashboardAction {
  icon: React.ReactNode;
  title: string;
  description: string;
  route: string;
  accent?: boolean;
}

export default function CaregiverDashboard() {
  const router = useRouter();
  const { currentPatient, patients, signOut, currentPeople, selectPatient } = useApp();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, []);

  const actions: DashboardAction[] = [
    {
      icon: <UserPlus size={22} color={Colors.accent} />,
      title: 'Add / Manage Patient',
      description: patients.length === 0 ? 'Create your first patient profile' : `${patients.length} patient${patients.length > 1 ? 's' : ''} set up`,
      route: '/caregiver/add-patient',
    },
    {
      icon: <Mic size={22} color={Colors.accent} />,
      title: 'Record Voice Sample',
      description: currentPatient?.hasVoiceSample ? 'Voice sample recorded' : 'Required for speaker identification',
      route: '/caregiver/voice-sample',
    },
    {
      icon: <Users size={22} color={Colors.accent} />,
      title: 'Manage People',
      description: `${currentPeople.length} people added`,
      route: '/caregiver/manage-people',
    },
    {
      icon: <Settings size={22} color={Colors.accent} />,
      title: 'Recognition Preferences',
      description: 'Audio, confidence, and display settings',
      route: '/caregiver/preferences',
    },
    {
      icon: <ClipboardList size={22} color={Colors.accent} />,
      title: 'Activity Log',
      description: 'Review recognition history',
      route: '/caregiver/activity-log',
    },
  ];

  const handleAction = (route: string) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(route as never);
  };

  const handleEnterPatientMode = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/patient-home');
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: () => {
          signOut();
          router.replace('/');
        },
      },
    ]);
  };

  const handleSwitchPatient = () => {
    if (!currentPatient || patients.length <= 1) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const currentIndex = patients.findIndex((patient) => patient.id === currentPatient.id);
    const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % patients.length : 0;
    const nextPatient = patients[nextIndex];
    if (nextPatient) {
      selectPatient(nextPatient.id);
    }
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <Animated.View style={{ opacity: fadeAnim }}>
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <View style={styles.logoSmall}>
                  <Heart size={16} color={Colors.white} fill={Colors.white} />
                </View>
                <Text style={styles.headerTitle}>RememberMe</Text>
              </View>
            </View>

            {currentPatient && (
              <View style={styles.patientCard}>
                <View style={styles.patientAvatar}>
                  <Text style={styles.patientAvatarText}>
                    {currentPatient.name.charAt(0)}
                  </Text>
                </View>
                <View style={styles.patientInfo}>
                  <Text style={styles.patientLabel}>Current Patient</Text>
                  <Text style={styles.patientName}>{currentPatient.name}</Text>
                </View>
                {patients.length > 1 && (
                  <TouchableOpacity
                    style={styles.switchButton}
                    onPress={handleSwitchPatient}
                    activeOpacity={0.8}
                    testID="switch-patient"
                  >
                    <RefreshCw size={16} color={Colors.accent} />
                    <Text style={styles.switchText}>Switch</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            <View style={styles.actionsContainer}>
              {actions.map((action, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.actionCard}
                  onPress={() => handleAction(action.route)}
                  activeOpacity={0.8}
                  testID={`action-${index}`}
                >
                  <View style={styles.actionIconContainer}>{action.icon}</View>
                  <View style={styles.actionContent}>
                    <Text style={styles.actionTitle}>{action.title}</Text>
                    <Text style={styles.actionDescription}>{action.description}</Text>
                  </View>
                  <ChevronRight size={18} color={Colors.textTertiary} />
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={styles.patientModeButton}
              onPress={handleEnterPatientMode}
              activeOpacity={0.85}
              testID="enter-patient-mode"
            >
              <Play size={22} color={Colors.white} fill={Colors.white} />
              <Text style={styles.patientModeText}>Enter Patient Mode</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.signOutButton}
              onPress={handleSignOut}
              testID="sign-out"
            >
              <LogOut size={16} color={Colors.textTertiary} />
              <Text style={styles.signOutText}>Sign out</Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
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
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 28,
    marginTop: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoSmall: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: Colors.text,
    letterSpacing: -0.3,
  },
  patientCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: Colors.cardShadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  patientAvatar: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: Colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  patientAvatarText: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: Colors.accent,
  },
  patientInfo: {
    flex: 1,
  },
  patientLabel: {
    fontSize: 12,
    color: Colors.textTertiary,
    fontWeight: '500' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  patientName: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  switchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: Colors.accentLight,
    borderRadius: 10,
  },
  switchText: {
    fontSize: 13,
    color: Colors.accent,
    fontWeight: '600' as const,
  },
  actionsContainer: {
    gap: 10,
    marginBottom: 24,
  },
  actionCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  actionIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 2,
  },
  actionDescription: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  patientModeButton: {
    backgroundColor: Colors.accent,
    borderRadius: 16,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 20,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  patientModeText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
  },
  signOutText: {
    fontSize: 14,
    color: Colors.textTertiary,
  },
});
