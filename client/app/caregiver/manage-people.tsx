import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Search, Plus, Camera, Mic, Volume2, ChevronRight } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useApp } from '@/providers/AppProvider';
import { Person } from '@/types';

export default function ManagePeopleScreen() {
  const router = useRouter();
  const { currentPeople, currentPatient } = useApp();
  const [search, setSearch] = useState<string>('');

  const filteredPeople = useMemo(
    () =>
      currentPeople.filter((p) =>
        p.name.toLowerCase().includes(search.toLowerCase())
      ),
    [currentPeople, search]
  );

  const handleAddPerson = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/caregiver/add-person');
  };

  const handlePersonTap = (person: Person) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({ pathname: '/caregiver/person-details', params: { id: person.id } });
  };

  const renderPerson = ({ item }: { item: Person }) => (
    <TouchableOpacity
      style={styles.personCard}
      onPress={() => handlePersonTap(item)}
      activeOpacity={0.8}
      testID={`person-${item.id}`}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{item.name.charAt(0)}</Text>
      </View>
      <View style={styles.personInfo}>
        <Text style={styles.personName}>{item.name}</Text>
        <Text style={styles.personRelationship}>
          {item.relationship
            ? item.relationship.charAt(0).toUpperCase() + item.relationship.slice(1)
            : 'Unknown'}
        </Text>
        <View style={styles.chips}>
          {item.photos.length > 0 && (
            <View style={styles.chip}>
              <Camera size={10} color={Colors.accent} />
              <Text style={styles.chipText}>{item.photos.length} photos</Text>
            </View>
          )}
          {item.hasVoiceMessage && (
            <View style={styles.chip}>
              <Mic size={10} color={Colors.accent} />
              <Text style={styles.chipText}>Voice</Text>
            </View>
          )}
          {item.hasAnnouncement && (
            <View style={[styles.chip, styles.chipReady]}>
              <Volume2 size={10} color={Colors.success} />
              <Text style={[styles.chipText, styles.chipReadyText]}>Audio ready</Text>
            </View>
          )}
        </View>
      </View>
      <ChevronRight size={18} color={Colors.textTertiary} />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {currentPatient && (
        <View style={styles.patientBadge}>
          <Text style={styles.patientBadgeText}>
            People for {currentPatient.name}
          </Text>
        </View>
      )}

      <View style={styles.searchContainer}>
        <Search size={18} color={Colors.textTertiary} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search people..."
          placeholderTextColor={Colors.textTertiary}
          testID="search-people"
        />
      </View>

      <FlatList
        data={filteredPeople}
        renderItem={renderPerson}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>No people added yet</Text>
            <Text style={styles.emptyDescription}>
              Add the people your patient knows so the app can help recognize them.
            </Text>
          </View>
        }
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={handleAddPerson}
        activeOpacity={0.85}
        testID="add-person-fab"
      >
        <Plus size={24} color={Colors.white} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  patientBadge: {
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 12,
  },
  patientBadgeText: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    paddingHorizontal: 14,
    marginHorizontal: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.text,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  personCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: Colors.accent,
  },
  personInfo: {
    flex: 1,
  },
  personName: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 2,
  },
  personRelationship: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  chips: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.accentLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  chipReady: {
    backgroundColor: '#E8F5EC',
  },
  chipText: {
    fontSize: 11,
    color: Colors.accent,
    fontWeight: '500' as const,
  },
  chipReadyText: {
    color: Colors.success,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 5,
  },
});
