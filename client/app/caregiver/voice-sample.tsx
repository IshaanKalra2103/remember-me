import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Mic, Square, Check, RefreshCw, ChevronLeft } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useAudioRecorder, useAudioRecorderState, RecordingPresets, AudioModule } from 'expo-audio';
import Colors from '@/constants/colors';
import { useApp } from '@/providers/AppProvider';
import { patientsApi } from '@/services/api';

export default function VoiceSampleScreen() {
  const router = useRouter();
  const { currentPatient, refreshPatients } = useApp();
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(audioRecorder);
  const [recordingUri, setRecordingUri] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const isRecording = recorderState.isRecording;
  const recordingDuration = Math.floor((recorderState.durationMillis || 0) / 1000);

  useEffect(() => {
    if (isRecording) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isRecording]);

  const startRecording = async () => {
    try {
      const permissionStatus = await AudioModule.requestRecordingPermissionsAsync();
      if (!permissionStatus.granted) {
        Alert.alert('Permission Required', 'Please grant microphone access to record a voice sample.');
        return;
      }

      // Enable recording mode on iOS
      await AudioModule.setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();

      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    } catch (error) {
      console.error('Failed to start recording:', error);
      Alert.alert('Error', 'Failed to start recording. Please try again.');
    }
  };

  const stopRecording = async () => {
    try {
      await audioRecorder.stop();
      const uri = audioRecorder.uri;
      setRecordingUri(uri);

      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    } catch (error) {
      console.error('Failed to stop recording:', error);
    }
  };

  const handleToggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const handleReRecord = async () => {
    setRecordingUri(null);
    // Reset recorder for new recording
    try {
      await audioRecorder.prepareToRecordAsync();
    } catch {
      // Ignore - will be prepared when startRecording is called
    }
  };

  const handleUpload = async () => {
    if (!recordingUri || !currentPatient) return;

    console.log('[VoiceSample] Starting upload, URI:', recordingUri);
    setIsUploading(true);
    try {
      await patientsApi.uploadVoiceSample(currentPatient.id, recordingUri, 'audio/m4a');
      await refreshPatients();
      setIsSuccess(true);
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error: unknown) {
      console.error('[VoiceSample] Failed to upload voice sample:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      Alert.alert('Upload Failed', `Failed to upload voice sample: ${message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (isSuccess) {
    return (
      <View style={styles.successContainer}>
        <View style={styles.successCircle}>
          <Check size={40} color={Colors.white} />
        </View>
        <Text style={styles.successTitle}>Voice Sample Saved</Text>
        <Text style={styles.successMessage}>
          {currentPatient?.name}'s voice will now be used to identify them during conversations.
        </Text>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => router.back()}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryButtonText}>Done</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <ChevronLeft size={24} color={Colors.text} />
      </TouchableOpacity>

      <View style={styles.content}>
        <Text style={styles.title}>Record Voice Sample</Text>
        <Text style={styles.subtitle}>
          Record {currentPatient?.name} speaking naturally for 10-30 seconds. This helps identify
          them during conversations.
        </Text>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Tips for a good recording:</Text>
          <Text style={styles.infoItem}>- Speak in a natural, conversational tone</Text>
          <Text style={styles.infoItem}>- Record in a quiet environment</Text>
          <Text style={styles.infoItem}>- Talk about anything (weather, day, etc.)</Text>
        </View>

        <View style={styles.recordingArea}>
          {recordingUri ? (
            <>
              <View style={styles.recordedIndicator}>
                <Check size={32} color={Colors.success} />
              </View>
              <Text style={styles.recordedText}>Recording complete</Text>
              <Text style={styles.durationText}>{formatDuration(recordingDuration)}</Text>
            </>
          ) : (
            <>
              <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                <TouchableOpacity
                  style={[styles.recordButton, isRecording && styles.recordButtonActive]}
                  onPress={handleToggleRecording}
                  activeOpacity={0.8}
                >
                  {isRecording ? (
                    <Square size={28} color={Colors.white} fill={Colors.white} />
                  ) : (
                    <Mic size={32} color={Colors.white} />
                  )}
                </TouchableOpacity>
              </Animated.View>
              <Text style={styles.recordLabel}>
                {isRecording ? 'Tap to stop' : 'Tap to start recording'}
              </Text>
              {isRecording && (
                <Text style={styles.durationText}>{formatDuration(recordingDuration)}</Text>
              )}
            </>
          )}
        </View>

        {recordingUri && (
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={handleReRecord}
              activeOpacity={0.8}
            >
              <RefreshCw size={18} color={Colors.accent} />
              <Text style={styles.secondaryButtonText}>Re-record</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.primaryButton, isUploading && styles.buttonDisabled]}
              onPress={handleUpload}
              disabled={isUploading}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryButtonText}>
                {isUploading ? 'Uploading...' : 'Save Voice Sample'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  backButton: {
    padding: 16,
    paddingTop: 60,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    lineHeight: 24,
    marginBottom: 24,
  },
  infoCard: {
    backgroundColor: Colors.accentLight,
    borderRadius: 14,
    padding: 16,
    marginBottom: 32,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.accentDark,
    marginBottom: 8,
  },
  infoItem: {
    fontSize: 14,
    color: Colors.accentDark,
    lineHeight: 22,
  },
  recordingArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordButton: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  recordButtonActive: {
    backgroundColor: Colors.destructive,
  },
  recordLabel: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginTop: 20,
    fontWeight: '500' as const,
  },
  durationText: {
    fontSize: 24,
    fontWeight: '600' as const,
    color: Colors.text,
    marginTop: 12,
  },
  recordedIndicator: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.successLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordedText: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
    marginTop: 20,
  },
  actionButtons: {
    gap: 12,
    paddingBottom: 40,
  },
  primaryButton: {
    backgroundColor: Colors.accent,
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  secondaryButton: {
    backgroundColor: Colors.accentLight,
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.accent,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: Colors.background,
  },
  successCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 12,
  },
  successMessage: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 36,
    paddingHorizontal: 20,
  },
});
