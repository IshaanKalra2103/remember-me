import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import {
  ArrowLeft,
  Brain,
  MessageCircle,
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  RefreshCcw,
  Send,
  Sparkles,
  X,
} from 'lucide-react-native';
import { useConversation } from '@elevenlabs/react-native';
import Colors from '@/constants/colors';
import { useApp } from '@/providers/AppProvider';
import {
  MemoryAgentConfigResponse,
  PatientMemoryRecord,
  fetchMemoryAgentConfig,
  fetchMemoryAgentHealth,
  fetchPatientMemories,
  generateMemoryCustomImage,
  setMemoryAgentPersonName,
} from '@/utils/backendApi';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
};

type SectionMode = 'ask' | 'cloud';

type CloudNode = {
  id: string;
  kind: 'filler' | 'memory' | 'core';
  x: number;
  y: number;
  z: number;
  size: number;
  imageUrl?: string;
  memory?: PatientMemoryRecord;
};

const MEMORY_STOCK_IMAGES = [
  'https://randomuser.me/api/portraits/women/11.jpg',
  'https://randomuser.me/api/portraits/men/12.jpg',
  'https://randomuser.me/api/portraits/women/22.jpg',
  'https://randomuser.me/api/portraits/men/23.jpg',
  'https://randomuser.me/api/portraits/women/31.jpg',
  'https://randomuser.me/api/portraits/men/34.jpg',
  'https://randomuser.me/api/portraits/women/45.jpg',
  'https://randomuser.me/api/portraits/men/46.jpg',
  'https://randomuser.me/api/portraits/women/55.jpg',
  'https://randomuser.me/api/portraits/men/58.jpg',
  'https://randomuser.me/api/portraits/women/63.jpg',
  'https://randomuser.me/api/portraits/men/64.jpg',
];

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function stockMemoryImage(seed: string): string {
  const idx = hashString(seed) % MEMORY_STOCK_IMAGES.length;
  return MEMORY_STOCK_IMAGES[idx];
}

function fillerImage(index: number): string {
  return `https://picsum.photos/seed/memory-filler-${index + 100}/100/100`;
}

function formatMemoryDate(value?: string | null): string {
  if (!value) {
    return 'Unknown date';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 10);
  }
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function memoryTypeTag(memory: PatientMemoryRecord): string {
  const text = `${memory.summary || ''} ${memory.transcription || ''}`.toLowerCase();
  if (memory.is_important) {
    return 'Important ⭐';
  }
  if (text.includes('doctor') || text.includes('health') || text.includes('medicine')) {
    return 'Health 🩺';
  }
  if (text.includes('birthday') || text.includes('family') || text.includes('visit')) {
    return 'Family 👪';
  }
  return 'Memory 💭';
}

function buildMemoryCloudNodes(
  memories: PatientMemoryRecord[],
  rotationDeg: number,
  orbSize: number
): CloudNode[] {
  const usableMemories = memories.slice(0, 45);
  const memoryCount = usableMemories.length;
  const fillerCount = Math.max(120, memoryCount * 6);
  const total = memoryCount + fillerCount;
  const golden = Math.PI * (3 - Math.sqrt(5));
  const rotation = (rotationDeg * Math.PI) / 180;
  const radius = orbSize * 0.43;

  const memorySlots = new Map<number, PatientMemoryRecord>();
  if (memoryCount > 0) {
    usableMemories.forEach((memory, i) => {
      let idx = Math.floor(((i + 1) / (memoryCount + 1)) * (total - 1));
      while (memorySlots.has(idx)) {
        idx = (idx + 1) % total;
      }
      memorySlots.set(idx, memory);
    });
  }

  const nodes: CloudNode[] = [];
  for (let i = 0; i < total; i += 1) {
    const yUnit = total > 1 ? 1 - (i / (total - 1)) * 2 : 0;
    const ringRadius = Math.sqrt(Math.max(0, 1 - yUnit * yUnit));
    const theta = golden * i;

    const x0 = Math.cos(theta) * ringRadius;
    const z0 = Math.sin(theta) * ringRadius;

    const xRot = x0 * Math.cos(rotation) - z0 * Math.sin(rotation);
    const zRot = x0 * Math.sin(rotation) + z0 * Math.cos(rotation);
    const depth = (zRot + 1) / 2;

    const memory = memorySlots.get(i);
    const isMemory = Boolean(memory);
    const size = isMemory ? 34 + depth * 16 : 14 + depth * 10;

    nodes.push({
      id: memory ? memory.id : `filler-${i}`,
      kind: memory ? 'memory' : 'filler',
      x: xRot * radius,
      y: yUnit * radius,
      z: zRot,
      size,
      imageUrl: memory ? stockMemoryImage(memory.id) : fillerImage(i),
      memory,
    });
  }

  nodes.push({
    id: 'core-memory-node',
    kind: 'core',
    x: 0,
    y: 0,
    z: 2,
    size: 66,
  });

  return nodes.sort((a, b) => a.z - b.z);
}

export default function PatientMemoryAgentScreen() {
  const router = useRouter();
  const { currentPatientId } = useApp();
  const { width: windowWidth } = useWindowDimensions();

  const [mode, setMode] = useState<SectionMode>('ask');

  const [query, setQuery] = useState('');
  const [isStarting, setIsStarting] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [micMuted, setMicMuted] = useState(false);

  const [agentStatus, setAgentStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [agentError, setAgentError] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [hasElevenLabsKey, setHasElevenLabsKey] = useState(false);
  const [agentConfig, setAgentConfig] = useState<MemoryAgentConfigResponse | null>(null);

  const [cloudLoading, setCloudLoading] = useState(false);
  const [cloudError, setCloudError] = useState<string | null>(null);
  const [cloudLoaded, setCloudLoaded] = useState(false);
  const [cloudMemories, setCloudMemories] = useState<PatientMemoryRecord[]>([]);
  const [cloudRotation, setCloudRotation] = useState(0);
  const isCloudDraggingRef = useRef(false);
  const cloudLastXRef = useRef<number | null>(null);
  const cloudDragDistanceRef = useRef(0);

  const [selectedMemory, setSelectedMemory] = useState<PatientMemoryRecord | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalImageById, setModalImageById] = useState<Record<string, string>>({});
  const [isGeneratingCustomImage, setIsGeneratingCustomImage] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Ask about a specific memory. You can type or use Start Voice.',
    },
  ]);

  const askScrollRef = useRef<ScrollView>(null);
  const contextSentConversationIdRef = useRef<string | null>(null);
  const pendingTypedMessageRef = useRef<string | null>(null);

  const orbSize = useMemo(() => Math.max(250, Math.min(windowWidth - 40, 410)), [windowWidth]);

  const cloudNodes = useMemo(
    () => buildMemoryCloudNodes(cloudMemories, cloudRotation, orbSize),
    [cloudMemories, cloudRotation, orbSize]
  );

  const addMessage = useCallback((role: ChatMessage['role'], text: string) => {
    const trimmed = text.trim();
    if (!trimmed) {
      return;
    }
    setMessages((prev) => [
      ...prev,
      {
        id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        role,
        text: trimmed,
      },
    ]);
  }, []);

  const conversation = useConversation({
    onConnect: ({ conversationId }) => {
      setSessionError(null);
      setMicMuted(false);
      addMessage('system', `Voice session connected (${conversationId}).`);
    },
    onDisconnect: ({ reason }) => {
      contextSentConversationIdRef.current = null;
      setMicMuted(false);
      addMessage('system', `Voice session ended (${reason}).`);
    },
    onMessage: ({ message, source }) => {
      const text = (message || '').trim();
      if (!text) {
        return;
      }

      if (source === 'user' && pendingTypedMessageRef.current === text) {
        pendingTypedMessageRef.current = null;
        return;
      }

      addMessage(source === 'ai' ? 'assistant' : 'user', text);
    },
    onError: (message) => {
      const detail = typeof message === 'string' ? message : 'Voice agent error.';
      setSessionError(detail);
      addMessage('system', `Voice error: ${detail}`);
    },
  });

  const isConnected = conversation.status === 'connected';

  const sessionStatusText = useMemo(() => {
    if (isStarting) {
      return 'connecting';
    }
    return conversation.status;
  }, [conversation.status, isStarting]);

  useEffect(() => {
    if (mode !== 'ask') {
      return;
    }
    requestAnimationFrame(() => {
      askScrollRef.current?.scrollToEnd({ animated: true });
    });
  }, [messages, mode]);

  const loadMemoryAgentConnection = useCallback(
    async (includeConversationToken = false) => {
      if (!currentPatientId) {
        setAgentStatus('error');
        setAgentError('No patient selected.');
        return null;
      }

      setAgentStatus('loading');
      setAgentError(null);

      try {
        const [health, config] = await Promise.all([
          fetchMemoryAgentHealth(),
          fetchMemoryAgentConfig(currentPatientId, {
            maxMemories: 5,
            includeConversationToken,
          }),
        ]);

        setHasElevenLabsKey(health.has_elevenlabs_key);
        setAgentConfig(config);
        setAgentStatus('ready');

        if (config.personName) {
          await setMemoryAgentPersonName(config.personName);
        }

        return config;
      } catch (error) {
        const detail =
          error instanceof Error ? error.message : 'Failed to initialize memory agent.';
        setAgentStatus('error');
        setAgentError(detail);
        return null;
      }
    },
    [currentPatientId]
  );

  const loadCloudMemories = useCallback(
    async (force = false) => {
      if (!currentPatientId) {
        setCloudError('No patient selected.');
        return;
      }
      if (!force && cloudLoaded) {
        return;
      }

      setCloudLoading(true);
      setCloudError(null);
      try {
        const rows = await fetchPatientMemories(currentPatientId, { limit: 200, offset: 0 });
        setCloudMemories(rows);
        setCloudLoaded(true);
      } catch (error) {
        const detail = error instanceof Error ? error.message : 'Failed to fetch memory cloud.';
        setCloudError(detail);
      } finally {
        setCloudLoading(false);
      }
    },
    [cloudLoaded, currentPatientId]
  );

  useEffect(() => {
    void loadMemoryAgentConnection(false);
  }, [loadMemoryAgentConnection]);

  useEffect(() => {
    if (mode === 'cloud') {
      void loadCloudMemories(false);
    }
  }, [loadCloudMemories, mode]);

  useEffect(() => {
    if (mode !== 'cloud' || modalVisible) {
      return;
    }
    const id = setInterval(() => {
      if (isCloudDraggingRef.current) {
        return;
      }
      setCloudRotation((prev) => (prev + 1.4) % 360);
    }, 80);
    return () => clearInterval(id);
  }, [mode, modalVisible]);

  const startVoiceSession = useCallback(async (): Promise<boolean> => {
    if (!currentPatientId) {
      setSessionError('No patient selected.');
      return false;
    }

    if (conversation.status === 'connected') {
      return true;
    }

    const permission = await Audio.requestPermissionsAsync();
    if (permission.status !== 'granted') {
      setSessionError('Microphone permission is required to start voice chat.');
      return false;
    }

    const startWithConfig = async (config: MemoryAgentConfigResponse) => {
      const startPayload = config.conversationToken
        ? { conversationToken: config.conversationToken }
        : { agentId: config.agentId };

      await conversation.startSession({
        ...startPayload,
        dynamicVariables: {
          patient_id: currentPatientId,
          linked_person: config.personName ?? 'unknown',
          memories_count: config.memoriesCount,
        },
      });
    };

    const baseConfig = agentConfig ?? (await loadMemoryAgentConnection(false));
    if (!baseConfig) {
      return false;
    }

    setIsStarting(true);
    setSessionError(null);

    try {
      await startWithConfig(baseConfig);
      return true;
    } catch (error) {
      try {
        const tokenConfig = await loadMemoryAgentConnection(true);
        if (!tokenConfig?.conversationToken) {
          throw error;
        }
        await startWithConfig(tokenConfig);
        return true;
      } catch (retryError) {
        const detail =
          retryError instanceof Error
            ? retryError.message
            : 'Failed to start voice session.';
        setSessionError(detail);
        return false;
      }
    } finally {
      setIsStarting(false);
    }
  }, [agentConfig, conversation, currentPatientId, loadMemoryAgentConnection]);

  const endVoiceSession = useCallback(async () => {
    if (conversation.status !== 'connected') {
      return;
    }
    try {
      await conversation.endSession();
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Failed to end voice session.';
      setSessionError(detail);
    }
  }, [conversation]);

  const toggleMic = useCallback(() => {
    const nextMuted = !micMuted;
    setMicMuted(nextMuted);
    conversation.setMicMuted(nextMuted);
  }, [conversation, micMuted]);

  useEffect(() => {
    if (!isConnected || !agentConfig) {
      return;
    }

    const conversationId = conversation.getId();
    if (!conversationId) {
      return;
    }
    if (contextSentConversationIdRef.current === conversationId) {
      return;
    }

    const context = [
      'Memory context for this patient:',
      agentConfig.contextText,
      agentConfig.personName
        ? `Current linked person name: ${agentConfig.personName}`
        : 'No linked person name yet.',
      'Use this only as memory aid context. If uncertain, ask a gentle follow-up.',
    ].join('\n');

    conversation.sendContextualUpdate(context);
    contextSentConversationIdRef.current = conversationId;
    addMessage('system', 'Memory context synced to the live voice agent.');
  }, [addMessage, agentConfig, conversation, isConnected]);

  const handleAsk = useCallback(async () => {
    const trimmed = query.trim();
    if (!trimmed || isSending) {
      return;
    }

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    setQuery('');
    setIsSending(true);

    try {
      if (!isConnected) {
        const started = await startVoiceSession();
        if (!started) {
          return;
        }
      }

      addMessage('user', trimmed);
      pendingTypedMessageRef.current = trimmed;
      conversation.sendUserActivity();
      conversation.sendUserMessage(trimmed);
    } finally {
      setIsSending(false);
    }
  }, [addMessage, conversation, isConnected, isSending, query, startVoiceSession]);

  const openMemoryModal = useCallback((memory: PatientMemoryRecord) => {
    setSelectedMemory(memory);
    setModalError(null);
    setModalVisible(true);
  }, []);

  const closeMemoryModal = useCallback(() => {
    setModalVisible(false);
    setSelectedMemory(null);
    setModalError(null);
  }, []);

  const handleGenerateCustomImage = useCallback(async () => {
    if (!selectedMemory || isGeneratingCustomImage) {
      return;
    }
    setModalError(null);
    setIsGeneratingCustomImage(true);
    try {
      const result = await generateMemoryCustomImage(selectedMemory.id);
      setModalImageById((prev) => ({
        ...prev,
        [selectedMemory.id]: result.image_url,
      }));
      setCloudMemories((prev) =>
        prev.map((memory) =>
          memory.id === selectedMemory.id
            ? { ...memory, custom_image_url: result.image_url }
            : memory
        )
      );
      setSelectedMemory((prev) =>
        prev ? { ...prev, custom_image_url: result.image_url } : prev
      );
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Failed to generate custom image.';
      setModalError(detail);
    } finally {
      setIsGeneratingCustomImage(false);
    }
  }, [isGeneratingCustomImage, selectedMemory]);

  const modalImageUrl = selectedMemory
    ? modalImageById[selectedMemory.id] || selectedMemory.custom_image_url || stockMemoryImage(selectedMemory.id)
    : null;

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft size={20} color={Colors.text} />
          </TouchableOpacity>
          <View style={styles.titleWrap}>
            <MessageCircle size={16} color={Colors.accent} />
            <Text style={styles.title}>Memory Section</Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.modeSwitcher}>
          <TouchableOpacity
            style={[styles.modeButton, mode === 'ask' && styles.modeButtonActive]}
            onPress={() => setMode('ask')}
          >
            <Text style={[styles.modeButtonText, mode === 'ask' && styles.modeButtonTextActive]}>
              Ask Specific Memory
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeButton, mode === 'cloud' && styles.modeButtonActive]}
            onPress={() => setMode('cloud')}
          >
            <Text style={[styles.modeButtonText, mode === 'cloud' && styles.modeButtonTextActive]}>
              Memory Cloud
            </Text>
          </TouchableOpacity>
        </View>

        {mode === 'ask' ? (
          <>
            <ScrollView
              ref={askScrollRef}
              style={styles.chat}
              contentContainerStyle={styles.chatContent}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.agentCard}>
                <View style={styles.agentHeader}>
                  <Text style={styles.agentTitle}>Voice Agent Link</Text>
                  <TouchableOpacity
                    style={styles.agentRefreshButton}
                    onPress={() => void loadMemoryAgentConnection(false)}
                  >
                    <RefreshCcw size={13} color={Colors.accentDark} />
                    <Text style={styles.agentRefreshText}>Refresh</Text>
                  </TouchableOpacity>
                </View>

                {agentStatus === 'loading' ? (
                  <View style={styles.agentLoadingRow}>
                    <ActivityIndicator size="small" color={Colors.accent} />
                    <Text style={styles.agentMetaText}>Loading memory-agent config...</Text>
                  </View>
                ) : agentStatus === 'error' ? (
                  <Text style={styles.agentErrorText}>{agentError || 'Memory-agent unavailable.'}</Text>
                ) : (
                  <>
                    <Text style={styles.agentMetaText}>Agent: {agentConfig?.agentId || 'unknown'}</Text>
                    <Text style={styles.agentMetaText}>
                      Memories in context: {agentConfig?.memoriesCount ?? 0}
                    </Text>
                    <Text style={styles.agentMetaText}>Voice session: {sessionStatusText}</Text>
                    <Text style={styles.agentMetaText}>
                      Voice service key: {hasElevenLabsKey ? 'configured' : 'missing'}
                    </Text>
                    {agentConfig?.personName ? (
                      <Text style={styles.agentMetaText}>
                        Linked person name: {agentConfig.personName}
                      </Text>
                    ) : null}
                    {agentConfig?.warnings?.map((warning, idx) => (
                      <Text key={`agent-warning-${idx}`} style={styles.agentWarningText}>
                        {warning}
                      </Text>
                    ))}
                    {sessionError ? <Text style={styles.agentErrorText}>{sessionError}</Text> : null}

                    <View style={styles.sessionButtonsRow}>
                      {isConnected ? (
                        <TouchableOpacity
                          style={[styles.sessionButton, styles.sessionButtonDanger]}
                          onPress={() => void endVoiceSession()}
                        >
                          <PhoneOff size={14} color={Colors.white} />
                          <Text style={styles.sessionButtonText}>End Voice</Text>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          style={[
                            styles.sessionButton,
                            styles.sessionButtonPrimary,
                            (isStarting || agentStatus !== 'ready') && styles.sessionButtonDisabled,
                          ]}
                          onPress={() => void startVoiceSession()}
                          disabled={isStarting || agentStatus !== 'ready'}
                        >
                          <Phone size={14} color={Colors.white} />
                          <Text style={styles.sessionButtonText}>Start Voice</Text>
                        </TouchableOpacity>
                      )}

                      <TouchableOpacity
                        style={[
                          styles.sessionButton,
                          styles.sessionButtonNeutral,
                          (!isConnected || isStarting) && styles.sessionButtonDisabled,
                        ]}
                        onPress={toggleMic}
                        disabled={!isConnected || isStarting}
                      >
                        {micMuted ? (
                          <MicOff size={14} color={Colors.text} />
                        ) : (
                          <Mic size={14} color={Colors.text} />
                        )}
                        <Text style={styles.sessionButtonTextDark}>{micMuted ? 'Unmute' : 'Mute'}</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </View>

              {messages.map((message) => (
                <View
                  key={message.id}
                  style={[
                    styles.bubble,
                    message.role === 'user'
                      ? styles.userBubble
                      : message.role === 'assistant'
                        ? styles.assistantBubble
                        : styles.systemBubble,
                  ]}
                >
                  <Text
                    style={[
                      styles.bubbleText,
                      message.role === 'user'
                        ? styles.userBubbleText
                        : message.role === 'assistant'
                          ? styles.assistantBubbleText
                          : styles.systemBubbleText,
                    ]}
                  >
                    {message.text}
                  </Text>
                </View>
              ))}
            </ScrollView>

            <View style={styles.inputBar}>
              <TextInput
                style={styles.input}
                value={query}
                onChangeText={setQuery}
                placeholder={isConnected ? 'Ask your memory question...' : 'Start voice or type to begin...'}
                placeholderTextColor={Colors.textTertiary}
                multiline
                maxLength={300}
                onFocus={() => {
                  if (isConnected) {
                    conversation.sendUserActivity();
                  }
                }}
              />
              <TouchableOpacity
                style={[
                  styles.sendButton,
                  (!query.trim() || isSending || agentStatus !== 'ready') && styles.sendButtonDisabled,
                ]}
                onPress={() => void handleAsk()}
                disabled={!query.trim() || isSending || agentStatus !== 'ready'}
              >
                {isSending ? (
                  <ActivityIndicator size="small" color={Colors.white} />
                ) : (
                  <Send size={16} color={Colors.white} />
                )}
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <ScrollView style={styles.cloudScroll} contentContainerStyle={styles.cloudScrollContent}>
            <View style={styles.cloudHeaderCard}>
              <Text style={styles.cloudTitle}>All Memories Cloud</Text>
              <Text style={styles.cloudSubtitle}>
                Tap any highlighted bubble to open details. Stock images are used by default.
              </Text>
              <TouchableOpacity
                style={styles.cloudRefreshButton}
                onPress={() => void loadCloudMemories(true)}
              >
                <RefreshCcw size={13} color={Colors.accentDark} />
                <Text style={styles.cloudRefreshText}>Refresh Memories</Text>
              </TouchableOpacity>
            </View>

            {cloudLoading ? (
              <View style={styles.cloudStateCard}>
                <ActivityIndicator color={Colors.accent} />
                <Text style={styles.cloudStateText}>Loading memory cloud...</Text>
              </View>
            ) : cloudError ? (
              <View style={styles.cloudStateCard}>
                <Text style={styles.agentErrorText}>{cloudError}</Text>
              </View>
            ) : (
              <View style={styles.cloudSphereWrap}>
                <View
                  style={[
                    styles.cloudSphere,
                    {
                      width: orbSize,
                      height: orbSize,
                      borderRadius: orbSize / 2,
                    },
                  ]}
                  onStartShouldSetResponder={() => true}
                  onMoveShouldSetResponder={() => true}
                  onResponderGrant={(event) => {
                    isCloudDraggingRef.current = true;
                    cloudDragDistanceRef.current = 0;
                    cloudLastXRef.current = event.nativeEvent.pageX;
                  }}
                  onResponderMove={(event) => {
                    const x = event.nativeEvent.pageX;
                    if (cloudLastXRef.current == null) {
                      cloudLastXRef.current = x;
                      return;
                    }
                    const deltaX = x - cloudLastXRef.current;
                    cloudDragDistanceRef.current += Math.abs(deltaX);
                    setCloudRotation((prev) => (prev + deltaX * 0.55) % 360);
                    cloudLastXRef.current = x;
                  }}
                  onResponderRelease={() => {
                    isCloudDraggingRef.current = false;
                    cloudLastXRef.current = null;
                  }}
                  onResponderTerminate={() => {
                    isCloudDraggingRef.current = false;
                    cloudLastXRef.current = null;
                  }}
                >
                  {cloudNodes.map((node) => {
                    const left = orbSize / 2 + node.x - node.size / 2;
                    const top = orbSize / 2 + node.y - node.size / 2;
                    const zIndex = node.kind === 'core' ? 999 : 20 + Math.round((node.z + 1) * 40);

                    if (node.kind === 'core') {
                      return (
                        <TouchableOpacity
                          key={node.id}
                          style={[
                            styles.cloudCoreNode,
                            {
                              width: node.size,
                              height: node.size,
                              borderRadius: node.size / 2,
                              left,
                              top,
                              zIndex,
                            },
                          ]}
                          onPress={() => {
                            if (cloudDragDistanceRef.current > 8) {
                              return;
                            }
                            setSelectedMemory(null);
                            setModalError(null);
                            setModalVisible(true);
                          }}
                          activeOpacity={0.88}
                        >
                          <Brain size={26} color={Colors.white} />
                        </TouchableOpacity>
                      );
                    }

                    if (node.kind === 'memory' && node.memory) {
                      return (
                        <TouchableOpacity
                          key={node.id}
                          style={[
                            styles.cloudMemoryNode,
                            {
                              width: node.size,
                              height: node.size,
                              borderRadius: node.size / 2,
                              left,
                              top,
                              zIndex,
                            },
                          ]}
                          onPress={() => {
                            if (cloudDragDistanceRef.current > 8) {
                              return;
                            }
                            openMemoryModal(node.memory!);
                          }}
                          activeOpacity={0.9}
                        >
                          <Image
                            source={{ uri: node.imageUrl }}
                            style={{ width: node.size, height: node.size, borderRadius: node.size / 2 }}
                          />
                        </TouchableOpacity>
                      );
                    }

                    return (
                      <View
                        key={node.id}
                        style={[
                          styles.cloudFillerNode,
                          {
                            width: node.size,
                            height: node.size,
                            borderRadius: node.size / 2,
                            left,
                            top,
                            opacity: 0.45 + ((node.z + 1) / 2) * 0.5,
                            zIndex,
                          },
                        ]}
                      >
                        <Image
                          source={{ uri: node.imageUrl }}
                          style={{ width: node.size, height: node.size, borderRadius: node.size / 2 }}
                        />
                      </View>
                    );
                  })}
                </View>
                <Text style={styles.cloudFootnote}>
                  {cloudMemories.length} memory bubbles loaded
                </Text>
              </View>
            )}
          </ScrollView>
        )}

        <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={closeMemoryModal}>
          <Pressable style={styles.modalOverlay} onPress={closeMemoryModal}>
            <Pressable style={styles.modalCard} onPress={() => {}}>
              <TouchableOpacity style={styles.modalCloseButton} onPress={closeMemoryModal}>
                <X size={18} color={Colors.textSecondary} />
              </TouchableOpacity>

              {selectedMemory ? (
                <>
                  {modalImageUrl ? (
                    <Image source={{ uri: modalImageUrl }} style={styles.modalAvatar} />
                  ) : (
                    <View style={[styles.modalAvatar, styles.modalCoreAvatar]}>
                      <Brain size={28} color={Colors.white} />
                    </View>
                  )}

                  <Text style={styles.modalTitle}>{selectedMemory.person_name || 'Memory'}</Text>
                  <Text style={styles.modalMeta}>
                    {memoryTypeTag(selectedMemory)} • {formatMemoryDate(selectedMemory.created_at)}
                  </Text>
                  <Text style={styles.modalSummary}>
                    {(selectedMemory.summary || selectedMemory.transcription || 'No details available yet.').trim()}
                  </Text>

                  <TouchableOpacity
                    style={styles.modalGenerateButton}
                    onPress={() => void handleGenerateCustomImage()}
                    disabled={isGeneratingCustomImage}
                  >
                    {isGeneratingCustomImage ? (
                      <ActivityIndicator size="small" color={Colors.accentDark} />
                    ) : (
                      <Sparkles size={15} color={Colors.accentDark} />
                    )}
                    <Text style={styles.modalGenerateButtonText}>
                      {isGeneratingCustomImage
                        ? 'Generating custom image...'
                        : 'Generate Custom Image (Nano Banana style)'}
                    </Text>
                  </TouchableOpacity>

                  {modalError ? <Text style={styles.modalError}>{modalError}</Text> : null}
                </>
              ) : (
                <>
                  <View style={[styles.modalAvatar, styles.modalCoreAvatar]}>
                    <Brain size={28} color={Colors.white} />
                  </View>
                  <Text style={styles.modalTitle}>Core Memory Profile</Text>
                  <Text style={styles.modalMeta}>Identity 🧠</Text>
                  <Text style={styles.modalSummary}>
                    This is the central memory identity node. Tap nearby bubbles to open specific stored memories.
                  </Text>
                </>
              )}
            </Pressable>
          </Pressable>
        </Modal>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.patientBg,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 8,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  headerSpacer: {
    width: 38,
    height: 38,
  },
  modeSwitcher: {
    marginHorizontal: 16,
    marginBottom: 10,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    padding: 5,
    flexDirection: 'row',
    gap: 6,
  },
  modeButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeButtonActive: {
    backgroundColor: Colors.accentLight,
  },
  modeButtonText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '600' as const,
  },
  modeButtonTextActive: {
    color: Colors.accentDark,
    fontWeight: '700' as const,
  },
  chat: {
    flex: 1,
  },
  chatContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 10,
  },
  agentCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
  },
  agentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  agentTitle: {
    color: Colors.accentDark,
    fontSize: 13,
    fontWeight: '700' as const,
  },
  agentRefreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: Colors.accentLight,
  },
  agentRefreshText: {
    color: Colors.accentDark,
    fontSize: 12,
    fontWeight: '600' as const,
  },
  agentLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  agentMetaText: {
    color: Colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  agentWarningText: {
    color: '#B68934',
    fontSize: 12,
    lineHeight: 17,
  },
  agentErrorText: {
    color: Colors.destructive,
    fontSize: 12,
    lineHeight: 17,
  },
  sessionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  sessionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 11,
    height: 34,
    borderRadius: 10,
  },
  sessionButtonPrimary: {
    backgroundColor: Colors.accent,
  },
  sessionButtonDanger: {
    backgroundColor: Colors.destructive,
  },
  sessionButtonNeutral: {
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sessionButtonDisabled: {
    opacity: 0.5,
  },
  sessionButtonText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '700' as const,
  },
  sessionButtonTextDark: {
    color: Colors.text,
    fontSize: 12,
    fontWeight: '700' as const,
  },
  bubble: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: '92%',
    gap: 6,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: Colors.accent,
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  systemBubble: {
    alignSelf: 'center',
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 21,
  },
  userBubbleText: {
    color: Colors.white,
  },
  assistantBubbleText: {
    color: Colors.text,
  },
  systemBubbleText: {
    color: Colors.textSecondary,
    fontSize: 12,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 110,
    borderRadius: 14,
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: Colors.text,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  cloudScroll: {
    flex: 1,
  },
  cloudScrollContent: {
    paddingHorizontal: 14,
    paddingBottom: 24,
    gap: 12,
  },
  cloudHeaderCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 12,
    gap: 6,
  },
  cloudTitle: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '700' as const,
  },
  cloudSubtitle: {
    color: Colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
  cloudRefreshButton: {
    marginTop: 4,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.accentLight,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  cloudRefreshText: {
    color: Colors.accentDark,
    fontSize: 12,
    fontWeight: '700' as const,
  },
  cloudStateCard: {
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cloudStateText: {
    color: Colors.textSecondary,
    fontSize: 13,
  },
  cloudSphereWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 8,
  },
  cloudSphere: {
    position: 'relative',
    backgroundColor: '#EFF1F2',
    borderWidth: 1,
    borderColor: '#E4E7E8',
    overflow: 'hidden',
  },
  cloudMemoryNode: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: Colors.white,
    overflow: 'hidden',
    shadowColor: Colors.cardShadow,
    shadowOpacity: 0.22,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  cloudFillerNode: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.75)',
    overflow: 'hidden',
  },
  cloudCoreNode: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF73',
    borderWidth: 2,
    borderColor: '#D5F4DE',
    shadowColor: '#4CAF73',
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 5,
  },
  cloudFootnote: {
    color: Colors.textSecondary,
    fontSize: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.30)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 26,
    backgroundColor: '#F7F7F7',
    borderWidth: 1,
    borderColor: '#ECECEC',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 18,
    alignItems: 'center',
    gap: 8,
  },
  modalCloseButton: {
    position: 'absolute',
    right: 12,
    top: 12,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ECECEC',
  },
  modalAvatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 3,
    borderColor: Colors.white,
  },
  modalCoreAvatar: {
    backgroundColor: '#4CAF73',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    color: Colors.text,
    fontSize: 20,
    fontWeight: '600' as const,
    textAlign: 'center',
  },
  modalMeta: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '600' as const,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  modalSummary: {
    color: '#59636A',
    fontSize: 15,
    lineHeight: 23,
    textAlign: 'center',
    marginTop: 2,
  },
  modalGenerateButton: {
    marginTop: 6,
    width: '100%',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DADDE1',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  modalGenerateButtonText: {
    color: Colors.accentDark,
    fontSize: 12,
    fontWeight: '700' as const,
  },
  modalError: {
    color: Colors.destructive,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
});
