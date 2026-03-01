import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Volume2, Eye, Bell } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useApp } from '@/providers/AppProvider';

export default function PreferencesScreen() {
  const { preferences, updatePreferences } = useApp();

  const handleToggle = (key: string, value: boolean) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    updatePreferences({ [key]: value });
  };

  const handleConfirmBehavior = (value: 'always' | 'when_unsure' | 'never') => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    updatePreferences({ confirmBehavior: value });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Volume2 size={18} color={Colors.accent} />
          <Text style={styles.sectionTitle}>Audio Behavior</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Text style={styles.toggleLabel}>Auto-play announcement</Text>
              <Text style={styles.toggleDescription}>
                Speak the name immediately after recognition
              </Text>
            </View>
            <Switch
              value={preferences.autoPlayAnnouncement}
              onValueChange={(v) => handleToggle('autoPlayAnnouncement', v)}
              trackColor={{ false: Colors.border, true: Colors.accent }}
              thumbColor={Colors.white}
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Text style={styles.toggleLabel}>Prefer personal voice</Text>
              <Text style={styles.toggleDescription}>
                Use the caregiver's recorded message when available
              </Text>
            </View>
            <Switch
              value={preferences.preferVoiceMessage}
              onValueChange={(v) => handleToggle('preferVoiceMessage', v)}
              trackColor={{ false: Colors.border, true: Colors.accent }}
              thumbColor={Colors.white}
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Text style={styles.toggleLabel}>Allow auto-repeat</Text>
              <Text style={styles.toggleDescription}>
                Automatically repeat the announcement after a pause
              </Text>
            </View>
            <Switch
              value={preferences.allowAutoRepeat}
              onValueChange={(v) => handleToggle('allowAutoRepeat', v)}
              trackColor={{ false: Colors.border, true: Colors.accent }}
              thumbColor={Colors.white}
            />
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Bell size={18} color={Colors.accent} />
          <Text style={styles.sectionTitle}>Confidence Behavior</Text>
        </View>

        <View style={styles.card}>
          {[
            {
              value: 'always' as const,
              label: 'Always confirm first',
              desc: 'Always ask "Is this...?" before speaking',
            },
            {
              value: 'when_unsure' as const,
              label: 'Confirm only when unsure',
              desc: 'Ask only when recognition confidence is low',
            },
            {
              value: 'never' as const,
              label: 'Speak automatically',
              desc: 'Always speak immediately when confident',
            },
          ].map((option, index) => (
            <React.Fragment key={option.value}>
              {index > 0 && <View style={styles.divider} />}
              <TouchableOpacity
                style={styles.radioRow}
                onPress={() => handleConfirmBehavior(option.value)}
                activeOpacity={0.8}
              >
                <View style={styles.radioInfo}>
                  <Text style={styles.radioLabel}>{option.label}</Text>
                  <Text style={styles.radioDescription}>{option.desc}</Text>
                </View>
                <View
                  style={[
                    styles.radio,
                    preferences.confirmBehavior === option.value &&
                      styles.radioActive,
                  ]}
                >
                  {preferences.confirmBehavior === option.value && (
                    <View style={styles.radioDot} />
                  )}
                </View>
              </TouchableOpacity>
            </React.Fragment>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Eye size={18} color={Colors.accent} />
          <Text style={styles.sectionTitle}>Patient Experience</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Text style={styles.toggleLabel}>Show large name</Text>
              <Text style={styles.toggleDescription}>
                Display the person's name in large text
              </Text>
            </View>
            <Switch
              value={preferences.showLargeName}
              onValueChange={(v) => handleToggle('showLargeName', v)}
              trackColor={{ false: Colors.border, true: Colors.accent }}
              thumbColor={Colors.white}
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Text style={styles.toggleLabel}>Show relationship</Text>
              <Text style={styles.toggleDescription}>
                Display the relationship under the name
              </Text>
            </View>
            <Switch
              value={preferences.showRelationship}
              onValueChange={(v) => handleToggle('showRelationship', v)}
              trackColor={{ false: Colors.border, true: Colors.accent }}
              thumbColor={Colors.white}
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Text style={styles.toggleLabel}>Calming chime</Text>
              <Text style={styles.toggleDescription}>
                Play a gentle sound before the announcement
              </Text>
            </View>
            <Switch
              value={preferences.calmingChime}
              onValueChange={(v) => handleToggle('calmingChime', v)}
              trackColor={{ false: Colors.border, true: Colors.accent }}
              thumbColor={Colors.white}
            />
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 28,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  toggleInfo: {
    flex: 1,
    marginRight: 12,
  },
  toggleLabel: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 2,
  },
  toggleDescription: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginHorizontal: 16,
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  radioInfo: {
    flex: 1,
    marginRight: 12,
  },
  radioLabel: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 2,
  },
  radioDescription: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: {
    borderColor: Colors.accent,
  },
  radioDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.accent,
  },
});
