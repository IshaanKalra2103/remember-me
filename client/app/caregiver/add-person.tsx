import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Animated,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  Check,
  ChevronRight,
  ChevronDown,
  Camera,
  Mic,
  Square,
  Play,
  X,
  Image as ImageIcon,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import Colors from '@/constants/colors';
import { useApp } from '@/providers/AppProvider';
import { Person } from '@/types';
import { relationships } from '@/mocks/data';

export default function AddPersonScreen() {
  const router = useRouter();
  const { addPerson, currentPatientId, uploadPhoto } = useApp();
  const [step, setStep] = useState<number>(0);
  const [name, setName] = useState<string>('');
  const [relationship, setRelationship] = useState<string>('');
  const [nickname, setNickname] = useState<string>('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [hasVoiceMessage, setHasVoiceMessage] = useState<boolean>(false);
  const [showRelPicker, setShowRelPicker] = useState<boolean>(false);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string>('');
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const stepTitles = ['Identity', 'Photos', 'Voice', 'Review'];

  const animateTransition = (callback: () => void) => {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
    ]).start();
    setTimeout(callback, 150);
  };

  const handlePickPhoto = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
      });
      if (!result.canceled && result.assets) {
        const newPhotos = result.assets.map((a) => a.uri);
        setPhotos([...photos, ...newPhotos]);
      }
    } catch (error) {
      console.log('[AddPerson] Photo picker error:', error);
    }
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos(photos.filter((_, i) => i !== index));
  };

  const handleNext = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (step < 3) {
      animateTransition(() => setStep(step + 1));
    } else {
      handleSave();
    }
  };

  const handleBack = () => {
    if (step > 0) {
      animateTransition(() => setStep(step - 1));
    }
  };

  const handleSave = async () => {
    if (!currentPatientId) return;

    setIsSubmitting(true);
    setSubmitError('');

    try {
      // Create the person first
      const newPerson = await addPerson({
        name: name.trim(),
        relationship,
        nickname: nickname.trim() || undefined,
      });

      // Upload photos in sequence
      for (const photoUri of photos) {
        try {
          await uploadPhoto(newPerson.id, photoUri);
        } catch (err) {
          console.warn('Failed to upload photo:', err);
        }
      }

      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      animateTransition(() => setStep(4));
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to save person');
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleRecord = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (isRecording) {
      setIsRecording(false);
      setHasVoiceMessage(true);
    } else {
      setIsRecording(true);
    }
  };

  const canProceed = () => {
    if (step === 0) return name.trim().length > 0 && relationship.length > 0;
    if (step === 1) return photos.length >= 1;
    return true;
  };

  if (step === 4) {
    return (
      <View style={styles.successContainer}>
        <View style={styles.successCircle}>
          <Check size={40} color={Colors.white} />
        </View>
        <Text style={styles.successTitle}>{name} Saved</Text>
        <Text style={styles.successMessage}>
          You can now create announcement audio from their profile.
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
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.stepBar}>
          {stepTitles.map((title, i) => (
            <View key={i} style={styles.stepBarItem}>
              <View style={[styles.stepBarDot, i <= step && styles.stepBarDotActive]} />
              <Text style={[styles.stepBarLabel, i <= step && styles.stepBarLabelActive]}>
                {title}
              </Text>
            </View>
          ))}
        </View>

        <Animated.View style={[styles.formContainer, { opacity: fadeAnim }]}>
          {step === 0 && (
            <View>
              <Text style={styles.stepTitle}>Who is this person?</Text>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Name</Text>
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="e.g. Priya"
                  placeholderTextColor={Colors.textTertiary}
                  autoFocus
                  testID="person-name"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Relationship</Text>
                <TouchableOpacity
                  style={styles.picker}
                  onPress={() => setShowRelPicker(!showRelPicker)}
                  testID="relationship-picker"
                >
                  <Text
                    style={[
                      styles.pickerText,
                      !relationship && styles.pickerPlaceholder,
                    ]}
                  >
                    {relationship
                      ? relationships.find((r) => r.value === relationship)?.label
                      : 'Select relationship'}
                  </Text>
                  <ChevronDown size={18} color={Colors.textTertiary} />
                </TouchableOpacity>
                {showRelPicker && (
                  <View style={styles.pickerOptions}>
                    {relationships.map((r) => (
                      <TouchableOpacity
                        key={r.value}
                        style={[
                          styles.pickerOption,
                          relationship === r.value && styles.pickerOptionActive,
                        ]}
                        onPress={() => {
                          setRelationship(r.value);
                          setShowRelPicker(false);
                        }}
                      >
                        <Text
                          style={[
                            styles.pickerOptionText,
                            relationship === r.value && styles.pickerOptionTextActive,
                          ]}
                        >
                          {r.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Nickname (optional)</Text>
                <TextInput
                  style={styles.input}
                  value={nickname}
                  onChangeText={setNickname}
                  placeholder="How should the app address them?"
                  placeholderTextColor={Colors.textTertiary}
                />
              </View>
            </View>
          )}

          {step === 1 && (
            <View>
              <Text style={styles.stepTitle}>Add Photos</Text>
              <View style={styles.infoCard}>
                <Camera size={18} color={Colors.accent} />
                <Text style={styles.infoCardText}>
                  Add several photos in different lighting and angles for better
                  recognition.
                </Text>
              </View>
              <Text style={styles.photoProgress}>
                {photos.length} photo{photos.length !== 1 ? 's' : ''} added
                {photos.length < 3 ? ` (${3 - photos.length} more recommended)` : ''}
              </Text>
              <View style={styles.photoGrid}>
                {photos.map((uri, index) => (
                  <View key={index} style={styles.photoItem}>
                    <Image source={{ uri }} style={styles.photoImage} />
                    <TouchableOpacity
                      style={styles.removePhoto}
                      onPress={() => handleRemovePhoto(index)}
                    >
                      <X size={12} color={Colors.white} />
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity
                  style={styles.addPhotoButton}
                  onPress={handlePickPhoto}
                  testID="add-photo"
                >
                  <ImageIcon size={24} color={Colors.textTertiary} />
                  <Text style={styles.addPhotoText}>Add</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {step === 2 && (
            <View>
              <Text style={styles.stepTitle}>Voice Message</Text>
              <Text style={styles.stepDescription}>
                Record a short reassurance message in your voice. This is optional
                but can be very comforting.
              </Text>
              <View style={styles.voiceCard}>
                <Text style={styles.voiceExample}>
                  Example: "Hi, it's {name}. I'm here with you."
                </Text>
                <View style={styles.voiceControls}>
                  <TouchableOpacity
                    style={[
                      styles.recordButton,
                      isRecording && styles.recordButtonActive,
                    ]}
                    onPress={toggleRecord}
                    testID="record-button"
                  >
                    {isRecording ? (
                      <Square size={20} color={Colors.white} fill={Colors.white} />
                    ) : (
                      <Mic size={20} color={Colors.white} />
                    )}
                  </TouchableOpacity>
                  <Text style={styles.recordLabel}>
                    {isRecording
                      ? 'Recording... Tap to stop'
                      : hasVoiceMessage
                      ? 'Message recorded'
                      : 'Tap to record'}
                  </Text>
                </View>
                {hasVoiceMessage && (
                  <TouchableOpacity style={styles.playbackButton}>
                    <Play size={16} color={Colors.accent} />
                    <Text style={styles.playbackText}>Play back</Text>
                  </TouchableOpacity>
                )}
              </View>
              <TouchableOpacity
                style={styles.skipButton}
                onPress={() => animateTransition(() => setStep(3))}
              >
                <Text style={styles.skipText}>Skip for now</Text>
              </TouchableOpacity>
            </View>
          )}

          {step === 3 && (
            <View>
              <Text style={styles.stepTitle}>Review</Text>
              <View style={styles.reviewCard}>
                <View style={styles.reviewAvatar}>
                  <Text style={styles.reviewAvatarText}>{name.charAt(0)}</Text>
                </View>
                <Text style={styles.reviewName}>{name}</Text>
                <Text style={styles.reviewRelationship}>
                  {relationships.find((r) => r.value === relationship)?.label}
                </Text>
                <View style={styles.reviewStats}>
                  <View style={styles.reviewStat}>
                    <Camera size={14} color={Colors.accent} />
                    <Text style={styles.reviewStatText}>
                      {photos.length} photos
                    </Text>
                  </View>
                  <View style={styles.reviewStat}>
                    <Mic size={14} color={hasVoiceMessage ? Colors.accent : Colors.textTertiary} />
                    <Text style={styles.reviewStatText}>
                      {hasVoiceMessage ? 'Voice message' : 'No voice message'}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          )}
        </Animated.View>

        <View style={styles.buttonRow}>
          {step > 0 && step < 4 && (
            <TouchableOpacity
              style={styles.backButton}
              onPress={handleBack}
              activeOpacity={0.8}
            >
              <Text style={styles.backButtonText}>Back</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[
              styles.primaryButton,
              (!canProceed() || isSubmitting) && styles.buttonDisabled,
              step > 0 && { flex: 1 },
            ]}
            onPress={handleNext}
            disabled={!canProceed() || isSubmitting}
            activeOpacity={0.85}
            testID="next-step"
          >
            <Text style={styles.primaryButtonText}>
              {isSubmitting ? 'Saving...' : step === 3 ? 'Save Person' : 'Continue'}
            </Text>
            {!isSubmitting && <ChevronRight size={18} color={Colors.white} />}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  stepBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginBottom: 28,
  },
  stepBarItem: {
    alignItems: 'center',
    gap: 6,
  },
  stepBarDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.border,
  },
  stepBarDotActive: {
    backgroundColor: Colors.accent,
  },
  stepBarLabel: {
    fontSize: 11,
    color: Colors.textTertiary,
    fontWeight: '500' as const,
  },
  stepBarLabelActive: {
    color: Colors.accent,
  },
  formContainer: {
    marginBottom: 28,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 20,
  },
  stepDescription: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 22,
    marginBottom: 20,
    marginTop: -8,
  },
  inputGroup: {
    marginBottom: 18,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    fontSize: 16,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  picker: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pickerText: {
    fontSize: 16,
    color: Colors.text,
  },
  pickerPlaceholder: {
    color: Colors.textTertiary,
  },
  pickerOptions: {
    marginTop: 8,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  pickerOption: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  pickerOptionActive: {
    backgroundColor: Colors.accentLight,
  },
  pickerOptionText: {
    fontSize: 15,
    color: Colors.text,
  },
  pickerOptionTextActive: {
    color: Colors.accent,
    fontWeight: '600' as const,
  },
  infoCard: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: Colors.accentLight,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  infoCardText: {
    flex: 1,
    fontSize: 13,
    color: Colors.accentDark,
    lineHeight: 19,
  },
  photoProgress: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 14,
    fontWeight: '500' as const,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  photoItem: {
    width: 96,
    height: 96,
    borderRadius: 14,
    overflow: 'hidden',
  },
  photoImage: {
    width: 96,
    height: 96,
  },
  removePhoto: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPhotoButton: {
    width: 96,
    height: 96,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  addPhotoText: {
    fontSize: 12,
    color: Colors.textTertiary,
    fontWeight: '500' as const,
  },
  voiceCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  voiceExample: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontStyle: 'italic' as const,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  voiceControls: {
    alignItems: 'center',
    gap: 12,
  },
  recordButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordButtonActive: {
    backgroundColor: Colors.destructive,
  },
  recordLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },
  playbackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: Colors.accentLight,
    borderRadius: 10,
  },
  playbackText: {
    fontSize: 14,
    color: Colors.accent,
    fontWeight: '500' as const,
  },
  skipButton: {
    alignSelf: 'center',
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  skipText: {
    fontSize: 14,
    color: Colors.textTertiary,
    textDecorationLine: 'underline',
  },
  reviewCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  reviewAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  reviewAvatarText: {
    fontSize: 28,
    fontWeight: '600' as const,
    color: Colors.accent,
  },
  reviewName: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 4,
  },
  reviewRelationship: {
    fontSize: 15,
    color: Colors.textSecondary,
    marginBottom: 20,
  },
  reviewStats: {
    flexDirection: 'row',
    gap: 20,
  },
  reviewStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  reviewStatText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  backButton: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 14,
    backgroundColor: Colors.surfaceSecondary,
  },
  backButtonText: {
    fontSize: 16,
    color: Colors.textSecondary,
    fontWeight: '600' as const,
  },
  primaryButton: {
    backgroundColor: Colors.accent,
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.white,
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
  },
});
