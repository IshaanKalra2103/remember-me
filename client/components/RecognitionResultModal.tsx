import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
  Easing,
  Platform,
} from 'react-native';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import {
  Check,
  Home,
  Mic,
  RotateCcw,
  Square,
  Volume2,
  X,
  XCircle,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { Person, RecognitionPreferences } from '@/types';
import { fetchAnnouncementAudio } from '@/utils/backendApi';

const CALMING_CHIME = require('@/assets/sounds/chime.mp3');

interface RecognitionResultModalProps {
  visible: boolean;
  person: Person | null;
  confidenceBand: 'high' | 'medium' | 'low';
  preferences: RecognitionPreferences;
  onClose: () => void;
  onRepeat: () => void;
  onNotCorrect: () => void;
  onStopRecording: () => void;
}

export default function RecognitionResultModal({
  visible,
  person,
  confidenceBand,
  preferences,
  onClose,
  onRepeat,
  onNotCorrect,
  onStopRecording,
}: RecognitionResultModalProps) {
  const [isAnnouncementPlaying, setIsAnnouncementPlaying] = useState(false);
  const [showConfirm, setShowConfirm] = useState<boolean>(false);
  const [isVisible, setIsVisible] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(1)).current;
  const announcementSoundRef = useRef<Audio.Sound | null>(null);
  const chimeSoundRef = useRef<Audio.Sound | null>(null);
  const hasPlayedRef = useRef<string | null>(null);

  // Store callbacks in refs to avoid dependency issues
  const onRepeatRef = useRef(onRepeat);
  onRepeatRef.current = onRepeat;

  const relationLabel = useMemo(() => {
    if (!person?.relationship) {
      return 'Someone you know';
    }
    return person.relationship.charAt(0).toUpperCase() + person.relationship.slice(1);
  }, [person]);

  const cleanupSounds = useCallback(async () => {
    const sounds = [announcementSoundRef.current, chimeSoundRef.current].filter(Boolean);
    announcementSoundRef.current = null;
    chimeSoundRef.current = null;

    await Promise.all(
      sounds.map(async (sound) => {
        try {
          await sound?.stopAsync();
        } catch {
          // Ignore stop failures during cleanup.
        }
        try {
          await sound?.unloadAsync();
        } catch {
          // Ignore unload failures during cleanup.
        }
      })
    );
  }, []);

  const stopAnnouncement = useCallback(async () => {
    setIsAnnouncementPlaying(false);
    await cleanupSounds();
  }, [cleanupSounds]);

  const playAnnouncement = useCallback(async (personToPlay: Person, useCalmingChime: boolean) => {
    try {
      await cleanupSounds();
      setIsAnnouncementPlaying(true);
      onRepeatRef.current();

      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        allowsRecordingIOS: true,
        shouldDuckAndroid: true,
        staysActiveInBackground: false,
      });

      if (useCalmingChime) {
        const { sound: chimeSound } = await Audio.Sound.createAsync(CALMING_CHIME, {
          shouldPlay: true,
        });
        chimeSoundRef.current = chimeSound;

        await new Promise<void>((resolve) => {
          chimeSound.setOnPlaybackStatusUpdate((status) => {
            if (status.isLoaded && status.didJustFinish) {
              resolve();
            }
          });

          setTimeout(resolve, 1600);
        });
      }

      const announcementUrl = await fetchAnnouncementAudio(personToPlay.id);
      if (!announcementUrl) {
        setIsAnnouncementPlaying(false);
        return;
      }

      const { sound } = await Audio.Sound.createAsync(
        { uri: announcementUrl },
        { shouldPlay: true }
      );
      announcementSoundRef.current = sound;

      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setIsAnnouncementPlaying(false);
          sound.unloadAsync().catch(() => {});
          announcementSoundRef.current = null;
        }
      });
    } catch (error) {
      console.warn('[RecognitionResultModal] Failed to play announcement:', error);
      setIsAnnouncementPlaying(false);
    }
  }, [cleanupSounds]);

  const animateClose = useCallback((callback: () => void) => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 1,
        duration: 250,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setIsVisible(false);
      callback();
    });
  }, [fadeAnim, slideAnim]);

  // Handle modal visibility changes
  useEffect(() => {
    if (!visible || !person) {
      // Only animate out if currently visible
      if (isVisible) {
        animateClose(() => {
          setShowConfirm(false);
          hasPlayedRef.current = null;
          void cleanupSounds();
          setIsAnnouncementPlaying(false);
        });
      }
      return;
    }

    // Show modal immediately
    setIsVisible(true);

    // Prevent re-triggering for the same person
    if (hasPlayedRef.current === person.id) {
      return;
    }

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 60,
        friction: 10,
        useNativeDriver: true,
      }),
    ]).start();

    const shouldConfirm =
      preferences.confirmBehavior === 'always' ||
      (preferences.confirmBehavior === 'when_unsure' && confidenceBand !== 'high');

    if (shouldConfirm) {
      setShowConfirm(true);
      hasPlayedRef.current = person.id;
    } else {
      setShowConfirm(false);
      hasPlayedRef.current = person.id;
      void playAnnouncement(person, preferences.calmingChime);
    }
  }, [visible, person?.id, confidenceBand, preferences.confirmBehavior, preferences.calmingChime, fadeAnim, slideAnim, cleanupSounds, playAnnouncement, isVisible, animateClose]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      void cleanupSounds();
    };
  }, [cleanupSounds]);

  const handleClose = async () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    await stopAnnouncement();
    animateClose(() => {
      onClose();
    });
  };

  const handleStopRecordingButton = async () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    await stopAnnouncement();
    onStopRecording();
    animateClose(() => {
      onClose();
    });
  };

  const handleRepeat = async () => {
    if (!person) return;
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setShowConfirm(false);
    await playAnnouncement(person, preferences.calmingChime);
  };

  const handleNotCorrect = async () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    await stopAnnouncement();
    onStopRecording();
    animateClose(() => {
      onNotCorrect();
    });
  };

  const handleConfirmYes = async () => {
    if (!person) return;
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setShowConfirm(false);
    await playAnnouncement(person, preferences.calmingChime);
  };

  const handleConfirmNo = async () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    await stopAnnouncement();
    onStopRecording();
    animateClose(() => {
      onNotCorrect();
    });
  };

  const handleStopAnnouncement = async () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    await stopAnnouncement();
  };

  return (
    <Modal
      visible={isVisible && !!person}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        <Animated.View
          style={[
            styles.panel,
            {
              transform: [
                {
                  translateY: slideAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 380],
                  }),
                },
              ],
            },
          ]}
        >
          {person && (
            <>
              <View style={styles.handle} />

              {isAnnouncementPlaying && (
                <View style={styles.audioPlaybackBadge}>
                  <Volume2 size={16} color={Colors.accent} />
                  <Text style={styles.audioPlaybackText}>Playing announcement audio</Text>
                  <TouchableOpacity onPress={handleStopAnnouncement} style={styles.stopButton}>
                    <Square size={12} color={Colors.textSecondary} fill={Colors.textSecondary} />
                  </TouchableOpacity>
                </View>
              )}

              <View style={styles.recordingBadge}>
                <Mic size={14} color={Colors.destructive} />
                <Text style={styles.recordingText}>Recording memory in background</Text>
                <TouchableOpacity onPress={handleStopRecordingButton} style={styles.stopRecordingButton}>
                  <Square size={10} color={Colors.white} fill={Colors.white} />
                  <Text style={styles.stopRecordingText}>Stop</Text>
                </TouchableOpacity>
              </View>

              {showConfirm ? (
                <View style={styles.confirmContainer}>
                  <Text style={styles.confirmQuestion}>Is this</Text>
                  <Text style={styles.nameText}>{person.name}?</Text>

                  <View style={styles.confirmButtons}>
                    <TouchableOpacity style={styles.confirmYes} onPress={handleConfirmYes}>
                      <Check size={30} color={Colors.white} />
                      <Text style={styles.confirmYesText}>Yes</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.confirmNo} onPress={handleConfirmNo}>
                      <X size={30} color={Colors.destructive} />
                      <Text style={styles.confirmNoText}>No</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <>
                  <View style={styles.avatarLarge}>
                    <Text style={styles.avatarLargeText}>{person.name.charAt(0)}</Text>
                  </View>
                  {preferences.showLargeName && (
                    <Text style={styles.nameText}>This is {person.name}</Text>
                  )}
                  {preferences.showRelationship && (
                    <Text style={styles.relationText}>Your {relationLabel}</Text>
                  )}

                  <View style={styles.confidenceBadge}>
                    <Text
                      style={[
                        styles.confidenceText,
                        confidenceBand !== 'high' && styles.confidenceTextLow,
                      ]}
                    >
                      {confidenceBand === 'high'
                        ? 'Confident'
                        : confidenceBand === 'medium'
                          ? 'Needs confirmation'
                          : 'Not sure'}
                    </Text>
                  </View>

                  <View style={styles.actionsContainer}>
                    <TouchableOpacity style={styles.goHomeButton} onPress={handleClose}>
                      <Home size={24} color={Colors.white} />
                      <Text style={styles.goHomeButtonText}>Home</Text>
                    </TouchableOpacity>

                    <View style={styles.actionButtonsRow}>
                      <TouchableOpacity style={styles.repeatButton} onPress={handleRepeat}>
                        <RotateCcw size={20} color={Colors.accent} />
                        <Text style={styles.repeatButtonText}>Repeat</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.notCorrectButton}
                        onPress={handleNotCorrect}
                      >
                        <XCircle size={20} color={Colors.destructive} />
                        <Text style={styles.notCorrectButtonText}>Not correct</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </>
              )}
            </>
          )}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  panel: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: Colors.patientBg,
    minHeight: '65%',
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 24,
    alignItems: 'center',
  },
  handle: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    marginBottom: 10,
  },
  audioPlaybackBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 8,
    backgroundColor: Colors.accentLight,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginBottom: 8,
  },
  audioPlaybackText: {
    fontSize: 14,
    color: Colors.accent,
    fontWeight: '600' as const,
  },
  stopButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 2,
  },
  recordingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 8,
    backgroundColor: Colors.destructiveLight,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    marginBottom: 18,
  },
  recordingText: {
    fontSize: 13,
    color: Colors.destructive,
    fontWeight: '600' as const,
  },
  stopRecordingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.destructive,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    marginLeft: 8,
  },
  stopRecordingText: {
    fontSize: 12,
    color: Colors.white,
    fontWeight: '600' as const,
  },
  confirmContainer: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  confirmQuestion: {
    fontSize: 22,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  confirmButtons: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 8,
  },
  confirmYes: {
    width: 120,
    height: 120,
    borderRadius: 28,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  confirmYesText: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.white,
  },
  confirmNo: {
    width: 120,
    height: 120,
    borderRadius: 28,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 2,
    borderColor: Colors.border,
  },
  confirmNoText: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.destructive,
  },
  avatarLarge: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  avatarLargeText: {
    fontSize: 40,
    fontWeight: '600' as const,
    color: Colors.accent,
  },
  nameText: {
    fontSize: 34,
    fontWeight: '700' as const,
    color: Colors.text,
    textAlign: 'center',
    lineHeight: 40,
  },
  relationText: {
    marginTop: 4,
    fontSize: 20,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  confidenceBadge: {
    marginTop: 10,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: Colors.surface,
  },
  confidenceText: {
    fontSize: 14,
    color: Colors.success,
    fontWeight: '600' as const,
  },
  confidenceTextLow: {
    color: Colors.warning,
  },
  actionsContainer: {
    width: '100%',
    gap: 12,
    marginTop: 'auto',
    paddingTop: 20,
  },
  goHomeButton: {
    backgroundColor: Colors.accent,
    borderRadius: 22,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  goHomeButtonText: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.white,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  repeatButton: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  repeatButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.accent,
  },
  notCorrectButton: {
    flex: 1,
    backgroundColor: Colors.destructiveLight,
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  notCorrectButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.destructive,
  },
});
