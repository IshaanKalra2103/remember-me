import { useEffect, useMemo, useRef, useState } from "react";
import { SafeAreaView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useConversation } from "@elevenlabs/react";

const AGENT_ID = "agent_9801kjjt1x3ferhvtf6xb7nwh0a3";
const NAME_BRIDGE_URL = "http://127.0.0.1:8081/api/person-name";
const NAME_POLL_INTERVAL_MS = 1500;
const PAGE_GRADIENT_STYLE = {
  minHeight: "100vh",
  backgroundImage: "linear-gradient(160deg, #d8b4fe 0%, #f4edff 45%, #ffffff 100%)"
};
const SYSTEM_PROMPT = [
  "You are Alzheimer, a strict echo assistant.",
  "When the user sends a name, reply with exactly that same name and nothing else.",
  "Do not add punctuation, extra words, greetings, or explanations.",
  "If the user sends empty text, reply with: Please enter a name."
].join(" ");

function getMessageText(message) {
  if (!message) {
    return "";
  }
  if (typeof message === "string") {
    return message;
  }
  if (typeof message.message === "string") {
    return message.message;
  }
  if (typeof message.text === "string") {
    return message.text;
  }
  if (typeof message.content === "string") {
    return message.content;
  }
  return "";
}

function isDisconnectCommand(text) {
  const normalized = text.toLowerCase().replace(/[^\w\s]/g, "").replace(/\s+/g, " ").trim();
  return normalized === "disconnect";
}

function isLikelyUserMessage(message) {
  const role = String(message?.role || message?.sender || message?.source || "").toLowerCase();
  const type = String(message?.type || "").toLowerCase();
  return (
    role.includes("user") ||
    role.includes("human") ||
    type.includes("user") ||
    type.includes("transcript") ||
    Boolean(message?.user_transcription_event)
  );
}

export default function App() {
  const [personName, setPersonName] = useState("");
  const [agentReply, setAgentReply] = useState("");
  const [errorText, setErrorText] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [bridgeStatus, setBridgeStatus] = useState("disconnected");
  const autoEndingRef = useRef(false);
  const lastBridgeNameRef = useRef("");

  const endCall = async (auto = false) => {
    try {
      await conversation.endSession();
    } catch (error) {
      if (auto) {
        autoEndingRef.current = false;
        setErrorText(error?.message || "Unable to auto-end call.");
      } else {
        setErrorText(error?.message || "Unable to end call.");
      }
    }
  };

  const conversation = useConversation({
    onConnect: () => {
      setErrorText("");
    },
    onDisconnect: () => {
      autoEndingRef.current = false;
      setConnecting(false);
    },
    onMessage: (message) => {
      const text = getMessageText(message).trim();
      if (text) {
        setAgentReply(text);

        if (isDisconnectCommand(text) && isLikelyUserMessage(message) && !autoEndingRef.current) {
          autoEndingRef.current = true;
          endCall(true);
        }
      }
    },
    onError: (error) => {
      setErrorText(error?.message || "Failed to communicate with ElevenLabs.");
    }
  });

  const statusLabel = useMemo(() => {
    if (connecting) return "connecting";
    return conversation.status || "disconnected";
  }, [connecting, conversation.status]);

  useEffect(() => {
    let stopped = false;

    const fetchBridgeName = async () => {
      try {
        const response = await fetch(NAME_BRIDGE_URL);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const payload = await response.json();
        const incomingName = String(payload?.name || "").trim();

        if (!stopped) {
          setBridgeStatus("connected");
        }
        if (incomingName && incomingName !== lastBridgeNameRef.current) {
          lastBridgeNameRef.current = incomingName;
          if (!stopped) {
            setPersonName(incomingName);
          }
        }
      } catch (_error) {
        if (!stopped) {
          setBridgeStatus("disconnected");
        }
      }
    };

    fetchBridgeName();
    const timer = setInterval(fetchBridgeName, NAME_POLL_INTERVAL_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, []);

  const ensureSession = async () => {
    if (conversation.status === "connected") {
      return;
    }

    setConnecting(true);
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      await conversation.startSession({
        agentId: AGENT_ID,
        connectionType: "webrtc",
        overrides: {
          prompt: SYSTEM_PROMPT
        }
      });
      setErrorText("");
    } finally {
      setConnecting(false);
    }
  };

  const handleEnter = async () => {
    let trimmed = personName.trim();
    if (!trimmed) {
      try {
        const response = await fetch(NAME_BRIDGE_URL);
        if (response.ok) {
          const payload = await response.json();
          const bridgeName = String(payload?.name || "").trim();
          if (bridgeName) {
            setPersonName(bridgeName);
            trimmed = bridgeName;
          }
        }
      } catch (_error) {
        // Ignore endpoint read errors and fall through to existing validation.
      }
    }

    if (!trimmed) {
      setAgentReply("Please enter a name.");
      return;
    }

    try {
      await ensureSession();
      await conversation.sendUserMessage(trimmed);
    } catch (error) {
      setErrorText(error?.message || "Unable to send message.");
    }
  };

  const handleEndCall = async () => {
    await endCall(false);
  };

  return (
    <div style={PAGE_GRADIENT_STYLE}>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="dark" />
        <View style={styles.container}>
          <View style={styles.notebookCard}>
            <Text style={styles.title}>Who do you want to learn about?</Text>
            <TextInput
              style={styles.input}
              placeholder="Waiting for terminal/API name..."
              value={personName}
              editable={false}
            />
            <TouchableOpacity style={styles.button} onPress={handleEnter} activeOpacity={0.85}>
              <Text style={styles.buttonText}>Enter</Text>
            </TouchableOpacity>
            {personName.trim() ? (
              <TouchableOpacity style={styles.endButton} onPress={handleEndCall} activeOpacity={0.85}>
                <Text style={styles.endButtonText}>End Call</Text>
              </TouchableOpacity>
            ) : null}

            <Text style={styles.meta}>Agent status: {statusLabel}</Text>
            <Text style={styles.meta}>Terminal name bridge: {bridgeStatus}</Text>
            {agentReply ? <Text style={styles.reply}>Agent reply: {agentReply}</Text> : null}
            {errorText ? <Text style={styles.error}>{errorText}</Text> : null}
          </View>
        </View>
      </SafeAreaView>
    </div>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "transparent"
  },
  container: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 20
  },
  notebookCard: {
    backgroundColor: "#fffafc",
    borderRadius: 18,
    borderWidth: 2,
    borderColor: "#e9d5ff",
    padding: 20,
    shadowColor: "#7c3aed",
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1f2937",
    marginBottom: 16
  },
  input: {
    height: 50,
    borderWidth: 2,
    borderColor: "#c4b5fd",
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 16,
    backgroundColor: "#ffffff"
  },
  button: {
    marginTop: 14,
    height: 50,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#a78bfa",
    backgroundColor: "#ede9fe",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#a78bfa",
    shadowOpacity: 0.22,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3
  },
  buttonText: {
    color: "#4c1d95",
    fontSize: 16,
    fontWeight: "700"
  },
  endButton: {
    marginTop: 10,
    height: 46,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#f0abfc",
    backgroundColor: "#fdf2f8",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#f9a8d4",
    shadowOpacity: 0.22,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3
  },
  endButtonText: {
    color: "#831843",
    fontSize: 15,
    fontWeight: "700"
  },
  meta: {
    marginTop: 14,
    color: "#5b21b6",
    fontSize: 14
  },
  reply: {
    marginTop: 8,
    color: "#1f2937",
    fontSize: 16
  },
  error: {
    marginTop: 8,
    color: "#b91c1c",
    fontSize: 14
  }
});
