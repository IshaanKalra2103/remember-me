import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import Colors from '@/constants/colors';

export default function PrivacyModal() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Your Privacy Matters</Text>

      <View style={styles.section}>
        <Text style={styles.heading}>How RememberMe Works</Text>
        <Text style={styles.body}>
          RememberMe helps patients recognize familiar faces using photos that caregivers provide. All recognition happens on this device.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.heading}>Your Data Stays Here</Text>
        <Text style={styles.body}>
          Photos, names, and personal information are stored only on this device. Nothing is uploaded to the internet or shared with anyone.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.heading}>Camera Access</Text>
        <Text style={styles.body}>
          The camera is used only when the patient taps "Who is here?" to identify someone. It is never recording in the background.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.heading}>Caregiver Control</Text>
        <Text style={styles.body}>
          Only caregivers can add or remove people, change settings, and view activity logs. Patient mode is protected by a PIN.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.heading}>You're in Charge</Text>
        <Text style={styles.body}>
          You can delete all data at any time from the caregiver settings. Uninstalling the app removes everything.
        </Text>
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
    padding: 24,
    paddingBottom: 48,
  },
  title: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 28,
  },
  section: {
    marginBottom: 24,
  },
  heading: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 8,
  },
  body: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
});
