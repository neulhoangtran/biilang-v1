import ModelCheckScreen from '@/components/ModelCheckScreen';
import { generateLocalAiReply } from '@/services/localAiService';
import { Audio } from 'expo-av';
import React, { useCallback, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

type Message = {
  id: string;
  role: 'ai' | 'user';
  text: string;
  createdAt: number;
  type?: 'text' | 'voice' | 'system';
};

const createInitialMessages = (): Message[] => [
  {
    id: 'welcome-1',
    role: 'ai',
    text: 'Hi! I am your English speaking partner. You can type or use the microphone to talk with me.',
    createdAt: Date.now(),
    type: 'text',
  },
];

export default function HomeScreen() {
  const [isModelReady, setIsModelReady] = useState(false);
  const [isSettingsMode, setIsSettingsMode] = useState(false);

  const [messages, setMessages] = useState<Message[]>(createInitialMessages());
  const [inputText, setInputText] = useState('');

  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);

  const [isAiThinking, setIsAiThinking] = useState(false);

  const [isAtBottom, setIsAtBottom] = useState(true);
  const [showScrollButton, setShowScrollButton] = useState(false);

  const scrollViewRef = useRef<ScrollView | null>(null);

  const createMessage = (
    role: 'ai' | 'user',
    text: string,
    type: 'text' | 'voice' | 'system' = 'text'
  ): Message => {
    return {
      id: `${role}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      role,
      text,
      createdAt: Date.now(),
      type,
    };
  };

  const scrollToBottom = useCallback((animated = true) => {
    requestAnimationFrame(() => {
      scrollViewRef.current?.scrollToEnd({ animated });
      setShowScrollButton(false);
      setIsAtBottom(true);
    });
  }, []);

  const appendMessages = useCallback(
    (newMessages: Message[]) => {
      setMessages(prev => [...prev, ...newMessages]);

      if (isAtBottom) {
        setTimeout(() => {
          scrollToBottom(true);
        }, 80);
      } else {
        setShowScrollButton(true);
      }
    },
    [isAtBottom, scrollToBottom]
  );

  const replaceMessageText = (messageId: string, text: string) => {
    setMessages(prev =>
      prev.map(message =>
        message.id === messageId
          ? {
              ...message,
              text,
            }
          : message
      )
    );

    if (isAtBottom) {
      setTimeout(() => {
        scrollToBottom(true);
      }, 80);
    } else {
      setShowScrollButton(true);
    }
  };

  const sendToLocalAi = async (text: string) => {
    const thinkingMessage = createMessage('ai', 'Thinking...', 'system');

    appendMessages([thinkingMessage]);
    setIsAiThinking(true);

    try {
      const reply = await generateLocalAiReply(text);

      replaceMessageText(
        thinkingMessage.id,
        reply || 'Can you tell me more?'
      );
    } catch (error) {
      console.error(error);

      replaceMessageText(
        thinkingMessage.id,
        'Sorry, I could not load the local AI model. Please check the model file in Settings and try again.'
      );
    } finally {
      setIsAiThinking(false);
    }
  };

  const sendTextMessage = async () => {
    const text = inputText.trim();

    if (!text || isAiThinking || isRecording) return;

    const userMessage = createMessage('user', text);

    setInputText('');
    appendMessages([userMessage]);

    await sendToLocalAi(text);
  };

  const startRecording = async () => {
    try {
      if (isAiThinking) return;

      const permission = await Audio.requestPermissionsAsync();

      if (!permission.granted) {
        Alert.alert('Microphone permission', 'Please allow microphone access.');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      const result = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      setRecording(result.recording);
      setIsRecording(true);
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Could not start recording.');
    }
  };

  const stopRecording = async () => {
    try {
      if (!recording) return;

      await recording.stopAndUnloadAsync();

      const uri = recording.getURI();

      setRecording(null);
      setIsRecording(false);

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });

      console.log('Recorded audio uri:', uri);

      const userVoiceMessage = createMessage(
        'user',
        'Voice message recorded. Speech-to-text will be connected in the next step.',
        'voice'
      );

      appendMessages([userVoiceMessage]);

      await sendToLocalAi(
        'The user sent a voice message. Speech-to-text is not connected yet. Ask the user to type or wait for voice transcription.'
      );
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Could not stop recording.');

      setRecording(null);
      setIsRecording(false);
    }
  };

  const toggleRecording = () => {
    if (isAiThinking) return;

    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const clearConversation = async () => {
    try {
      if (recording) {
        await recording.stopAndUnloadAsync();
      }
    } catch (error) {
      console.error(error);
    }

    setRecording(null);
    setIsRecording(false);
    setIsAiThinking(false);
    setMessages(createInitialMessages());
    setInputText('');

    setTimeout(() => {
      scrollToBottom(false);
    }, 80);
  };

  const openSettings = async () => {
    try {
      if (recording) {
        await recording.stopAndUnloadAsync();
      }
    } catch (error) {
      console.error(error);
    }

    setRecording(null);
    setIsRecording(false);
    setIsAiThinking(false);
    setIsSettingsMode(true);
    setIsModelReady(false);
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;

    const paddingToBottom = 80;
    const isNearBottom =
      layoutMeasurement.height + contentOffset.y >=
      contentSize.height - paddingToBottom;

    setIsAtBottom(isNearBottom);

    if (isNearBottom) {
      setShowScrollButton(false);
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);

    return date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!isModelReady) {
    return (
      <ModelCheckScreen
        autoContinue={!isSettingsMode}
        onReady={() => {
          setIsSettingsMode(false);
          setIsModelReady(true);
        }}
      />
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.select({
        ios: 'padding',
        android: undefined,
      })}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Biilang</Text>
          <Text style={styles.subtitle}>
            {isAiThinking
              ? 'AI is thinking...'
              : isRecording
                ? 'Recording...'
                : 'AI Speaking English'}
          </Text>
        </View>

        <View style={styles.headerActions}>
          <Pressable style={styles.settingsButton} onPress={openSettings}>
            <Text style={styles.settingsButtonText}>Settings</Text>
          </Pressable>

          <Pressable style={styles.clearButton} onPress={clearConversation}>
            <Text style={styles.clearButtonText}>Clear</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.chatWrapper}>
        <ScrollView
          ref={scrollViewRef}
          style={styles.chatBox}
          contentContainerStyle={styles.chatContent}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          onContentSizeChange={() => {
            if (isAtBottom) {
              scrollToBottom(false);
            } else {
              setShowScrollButton(true);
            }
          }}
          keyboardShouldPersistTaps="handled"
        >
          {messages.map(message => {
            const isUser = message.role === 'user';
            const isSystem = message.type === 'system';

            return (
              <View
                key={message.id}
                style={[
                  styles.messageRow,
                  isUser ? styles.userMessageRow : styles.aiMessageRow,
                ]}
              >
                <View
                  style={[
                    styles.messageBubble,
                    isUser ? styles.userBubble : styles.aiBubble,
                    isSystem && styles.systemBubble,
                  ]}
                >
                  <Text
                    style={[
                      styles.messageText,
                      isUser ? styles.userMessageText : styles.aiMessageText,
                      isSystem && styles.systemMessageText,
                    ]}
                  >
                    {message.text}
                  </Text>

                  <View style={styles.messageFooter}>
                    {message.type === 'voice' && (
                      <Text
                        style={[
                          styles.messageMeta,
                          isUser && styles.userMessageMeta,
                        ]}
                      >
                        Voice
                      </Text>
                    )}

                    <Text
                      style={[
                        styles.messageMeta,
                        isUser && styles.userMessageMeta,
                      ]}
                    >
                      {formatTime(message.createdAt)}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })}
        </ScrollView>

        {showScrollButton && (
          <Pressable
            style={styles.scrollButton}
            onPress={() => scrollToBottom(true)}
          >
            <Text style={styles.scrollButtonText}>↓ New message</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.inputPanel}>
        <Pressable
          style={[
            styles.microButton,
            isRecording && styles.microButtonRecording,
            isAiThinking && styles.disabledButton,
          ]}
          onPress={toggleRecording}
          disabled={isAiThinking}
        >
          <Text style={styles.microButtonText}>
            {isRecording ? '■' : '🎙'}
          </Text>
        </Pressable>

        <TextInput
          value={inputText}
          onChangeText={setInputText}
          placeholder={
            isAiThinking
              ? 'Please wait for AI reply...'
              : isRecording
                ? 'Recording...'
                : 'Type your message...'
          }
          placeholderTextColor="#9ca3af"
          style={styles.input}
          multiline
          maxLength={500}
          editable={!isAiThinking && !isRecording}
          returnKeyType="send"
          onSubmitEditing={sendTextMessage}
        />

        <Pressable
          style={[
            styles.sendButton,
            (!inputText.trim() || isAiThinking || isRecording) &&
              styles.sendButtonDisabled,
          ]}
          onPress={sendTextMessage}
          disabled={!inputText.trim() || isAiThinking || isRecording}
        >
          <Text style={styles.sendButtonText}>Send</Text>
        </Pressable>
      </View>

      {isRecording && (
        <View style={styles.recordingBar}>
          <Text style={styles.recordingText}>
            Recording... tap the red button to stop.
          </Text>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7f7f7',
  },
  header: {
    paddingTop: 54,
    paddingHorizontal: 18,
    paddingBottom: 14,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#111827',
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  settingsButton: {
    backgroundColor: '#dbeafe',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
  },
  settingsButtonText: {
    color: '#1d4ed8',
    fontSize: 14,
    fontWeight: '800',
  },
  clearButton: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
  },
  clearButtonText: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '700',
  },
  chatWrapper: {
    flex: 1,
    position: 'relative',
  },
  chatBox: {
    flex: 1,
  },
  chatContent: {
    padding: 16,
    paddingBottom: 24,
  },
  messageRow: {
    width: '100%',
    marginBottom: 12,
  },
  aiMessageRow: {
    alignItems: 'flex-start',
  },
  userMessageRow: {
    alignItems: 'flex-end',
  },
  messageBubble: {
    maxWidth: '84%',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  aiBubble: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 6,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  userBubble: {
    backgroundColor: '#111827',
    borderTopRightRadius: 6,
  },
  systemBubble: {
    backgroundColor: '#f9fafb',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 23,
  },
  aiMessageText: {
    color: '#111827',
  },
  userMessageText: {
    color: '#ffffff',
  },
  systemMessageText: {
    color: '#6b7280',
    fontStyle: 'italic',
  },
  messageFooter: {
    marginTop: 7,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  messageMeta: {
    fontSize: 11,
    color: '#9ca3af',
  },
  userMessageMeta: {
    color: '#d1d5db',
  },
  scrollButton: {
    position: 'absolute',
    bottom: 14,
    alignSelf: 'center',
    backgroundColor: '#111827',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
  },
  scrollButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  inputPanel: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  microButton: {
    width: 46,
    height: 46,
    borderRadius: 999,
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  microButtonRecording: {
    backgroundColor: '#dc2626',
  },
  microButtonText: {
    color: '#111827',
    fontSize: 20,
    fontWeight: '900',
  },
  input: {
    flex: 1,
    maxHeight: 120,
    minHeight: 46,
    borderRadius: 18,
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#111827',
    fontSize: 16,
  },
  sendButton: {
    minWidth: 64,
    height: 46,
    borderRadius: 999,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  sendButtonDisabled: {
    backgroundColor: '#bfdbfe',
  },
  sendButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  disabledButton: {
    opacity: 0.6,
  },
  recordingBar: {
    backgroundColor: '#fee2e2',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderTopWidth: 1,
    borderTopColor: '#fecaca',
  },
  recordingText: {
    textAlign: 'center',
    color: '#991b1b',
    fontSize: 13,
    fontWeight: '700',
  },
});