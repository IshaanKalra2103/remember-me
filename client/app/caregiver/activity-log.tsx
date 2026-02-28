import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
} from 'react-native';
import {
  UserCheck,
  HelpCircle,
  XCircle,
  Volume2,
  Phone,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useApp } from '@/providers/AppProvider';
import { ActivityLogEntry } from '@/types';

const getLogIcon = (type: ActivityLogEntry['type']) => {
  switch (type) {
    case 'identified':
      return <UserCheck size={18} color={Colors.success} />;
    case 'unsure':
      return <HelpCircle size={18} color={Colors.warning} />;
    case 'not_correct':
      return <XCircle size={18} color={Colors.destructive} />;
    case 'audio_played':
      return <Volume2 size={18} color={Colors.accent} />;
    case 'help_requested':
      return <Phone size={18} color={Colors.textSecondary} />;
    default:
      return null;
  }
};

const getLogMessage = (entry: ActivityLogEntry): string => {
  switch (entry.type) {
    case 'identified':
      return `Identified ${entry.personName ?? 'someone'}${entry.confidence === 'high' ? ' (High confidence)' : ' (Low confidence)'}`;
    case 'unsure':
      return 'Unsure, asked for help';
    case 'not_correct':
      return `User tapped "Not correct"${entry.personName ? ` for ${entry.personName}` : ''}`;
    case 'audio_played':
      return `Audio played${entry.personName ? ` for ${entry.personName}` : ''}`;
    case 'help_requested':
      return 'Asked caregiver for help';
    default:
      return '';
  }
};

const formatTime = (timestamp: string): string => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const getDateLabel = (timestamp: string): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

interface SectionData {
  title: string;
  data: ActivityLogEntry[];
}

export default function ActivityLogScreen() {
  const { currentActivityLog } = useApp();

  const sections = useMemo<SectionData[]>(() => {
    const groups: Record<string, ActivityLogEntry[]> = {};
    currentActivityLog.forEach((entry) => {
      const label = getDateLabel(entry.timestamp);
      if (!groups[label]) groups[label] = [];
      groups[label].push(entry);
    });
    return Object.entries(groups).map(([title, data]) => ({ title, data }));
  }, [currentActivityLog]);

  const renderItem = ({ item }: { item: ActivityLogEntry }) => (
    <View style={styles.logCard}>
      <View style={styles.logIconContainer}>{getLogIcon(item.type)}</View>
      <View style={styles.logContent}>
        <Text style={styles.logMessage}>{getLogMessage(item)}</Text>
        <Text style={styles.logTime}>{formatTime(item.timestamp)}</Text>
      </View>
    </View>
  );

  const renderSectionHeader = ({ section }: { section: SectionData }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{section.title}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <SectionList
        sections={sections}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>No activity yet</Text>
            <Text style={styles.emptyDescription}>
              Recognition events will appear here when Patient Mode is used.
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  listContent: {
    padding: 20,
    paddingBottom: 40,
  },
  sectionHeader: {
    marginTop: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.textTertiary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  logCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  logIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logContent: {
    flex: 1,
  },
  logMessage: {
    fontSize: 15,
    color: Colors.text,
    fontWeight: '500' as const,
    marginBottom: 2,
  },
  logTime: {
    fontSize: 12,
    color: Colors.textTertiary,
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
});
