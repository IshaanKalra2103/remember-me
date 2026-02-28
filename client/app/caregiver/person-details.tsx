import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { Image } from 'expo-image';
import {
  Camera,
  Mic,
  Volume2,
  Trash2,
  Play,
  RefreshCw,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useApp } from '@/providers/AppProvider';

export default function PersonDetailsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { people, removePerson, updatePerson } = useApp();
  const person = people.find((p) => p.id === id);
  const [confirmDelete, setConfirmDelete] = useState<boolean>(false);

  if (!person) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Person not found</Text>
      </View>
    );
  }

  const handleDelete = () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    Alert.alert(
      'Remove Person',
      `Are you sure you want to remove ${person.name}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => setConfirmDelete(false) },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            removePerson(person.id);
            if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            router.back();
          },
        },
      ]
    );
  };

  const handleGenerateAnnouncement = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    updatePerson({ ...person, hasAnnouncement: true });
  };

  const relationLabel =
    person.relationship.charAt(0).toUpperCase() + person.relationship.slice(1);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: person.name }} />

      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{person.name.charAt(0)}</Text>
        </View>
        <Text style={styles.name}>{person.name}</Text>
        <Text style={styles.relationship}>{relationLabel}</Text>
        {person.nickname && (
          <Text style={styles.nickname}>Goes by "{person.nickname}"</Text>
        )}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Camera size={18} color={Colors.accent} />
          <Text style={styles.sectionTitle}>
            Photos ({person.photos.length})
          </Text>
        </View>
        <View style={styles.photoGrid}>
          {person.photos.map((uri, index) => (
            <View key={index} style={styles.photoItem}>
              <Image source={{ uri }} style={styles.photoImage} />
            </View>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Mic size={18} color={Colors.accent} />
          <Text style={styles.sectionTitle}>Voice Message</Text>
        </View>
        {person.hasVoiceMessage ? (
          <TouchableOpacity style={styles.audioCard} activeOpacity={0.8}>
            <Play size={18} color={Colors.accent} />
            <Text style={styles.audioCardText}>Play voice message</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyCardText}>No voice message recorded</Text>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Volume2 size={18} color={Colors.accent} />
          <Text style={styles.sectionTitle}>Announcement Audio</Text>
        </View>
        {person.hasAnnouncement ? (
          <View>
            <TouchableOpacity style={styles.audioCard} activeOpacity={0.8}>
              <Play size={18} color={Colors.accent} />
              <Text style={styles.audioCardText}>
                "This is {person.name}, your {person.relationship}"
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.regenerateButton}
              onPress={handleGenerateAnnouncement}
            >
              <RefreshCw size={14} color={Colors.accent} />
              <Text style={styles.regenerateText}>Regenerate</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.generateButton}
            onPress={handleGenerateAnnouncement}
            activeOpacity={0.85}
          >
            <Volume2 size={18} color={Colors.white} />
            <Text style={styles.generateButtonText}>
              Create Announcement Audio
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <TouchableOpacity
        style={[styles.deleteButton, confirmDelete && styles.deleteButtonConfirm]}
        onPress={handleDelete}
        activeOpacity={0.8}
        testID="delete-person"
      >
        <Trash2
          size={16}
          color={confirmDelete ? Colors.white : Colors.destructive}
        />
        <Text
          style={[
            styles.deleteText,
            confirmDelete && styles.deleteTextConfirm,
          ]}
        >
          {confirmDelete ? 'Confirm Remove' : 'Remove Person'}
        </Text>
      </TouchableOpacity>
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
  errorText: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '600' as const,
    color: Colors.accent,
  },
  name: {
    fontSize: 26,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 4,
  },
  relationship: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  nickname: {
    fontSize: 14,
    color: Colors.textTertiary,
    marginTop: 4,
    fontStyle: 'italic' as const,
  },
  section: {
    marginBottom: 24,
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
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  photoItem: {
    width: 100,
    height: 100,
    borderRadius: 14,
    overflow: 'hidden',
  },
  photoImage: {
    width: 100,
    height: 100,
  },
  audioCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  audioCardText: {
    fontSize: 15,
    color: Colors.text,
    flex: 1,
  },
  emptyCard: {
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: 14,
    padding: 16,
  },
  emptyCardText: {
    fontSize: 14,
    color: Colors.textTertiary,
  },
  regenerateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-end',
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  regenerateText: {
    fontSize: 13,
    color: Colors.accent,
    fontWeight: '500' as const,
  },
  generateButton: {
    backgroundColor: Colors.accent,
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  generateButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 14,
    backgroundColor: Colors.destructiveLight,
    marginTop: 12,
  },
  deleteButtonConfirm: {
    backgroundColor: Colors.destructive,
  },
  deleteText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.destructive,
  },
  deleteTextConfirm: {
    color: Colors.white,
  },
});
