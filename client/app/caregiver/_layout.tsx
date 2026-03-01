import { Stack } from 'expo-router';
import React from 'react';
import Colors from '@/constants/colors';

export default function CaregiverLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Colors.background },
        headerTintColor: Colors.text,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: Colors.background },
        headerBackTitle: 'Back',
      }}
    >
      <Stack.Screen name="dashboard" options={{ title: '', headerLeft: () => null }} />
      <Stack.Screen name="add-patient" options={{ title: 'New Patient' }} />
      <Stack.Screen name="manage-people" options={{ title: 'People' }} />
      <Stack.Screen name="add-person" options={{ title: 'Add Person' }} />
      <Stack.Screen name="person-details" options={{ title: '' }} />
      <Stack.Screen name="preferences" options={{ title: 'Preferences' }} />
      <Stack.Screen name="activity-log" options={{ title: 'Activity' }} />
    </Stack>
  );
}
