import ModelCheckScreen from '@/components/ModelCheckScreen';
import { generateLocalAiReply } from '@/services/localAiService';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import * as Speech from 'expo-speech';
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
  voiceUri?: string;
};

const MAX_SAVED_VOICES = 20;

/**
 * Số message gần nhất gửi kèm vào AI để AI hiểu ngữ cảnh.
 * Muốn tăng context thì chỉ cần đổi số này, ví dụ 10 hoặc 20.
 */
const AI_CONTEXT_MESSAGE_LIMIT = 5;

const createInitialMessages = (): Message[] => [
  {
    id: 'welcome-1',
    role: 'ai',
    text: 'Hi! I am your AI speaking partner. You can type or use the microphone to talk with me.',
    createdAt: Date.now(),
    type: 'text',
  },
];

export default function AiTalkScreen() {
  const [isModelReady, setIsModelReady] = useState(false);
  const [isSettingsMode, setIsSettingsMode] = useState(false);

  const [messages, setMessages] = useState<Message[]>(createInitialMessages());
  const [inputText, setInputText] = useState('');

  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);

  const [isAiThinking, setIsAiThinking] = useState(false);
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);

  const [isAtBottom, setIsAtBottom] = useState(true);
  const [showScrollButton, setShowScrollButton] = useState(false);

  const scrollViewRef = useRef<ScrollView | null>(null);
  const playingSoundRef = useRef<Audio.Sound | null>(null);
  const savedVoiceUrisRef = useRef<string[]>([]);

  const createMessage = (
    role: 'ai' | 'user',
    text: string,
    type: 'text' | 'voice' | 'system' = 'text',
    voiceUri?: string
  ): Message => {
    return {
      id: `${role}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      role,
      text,
      createdAt: Date.now(),
      type,
      voiceUri,
    };
  };

  const buildAiPromptWithHistory = (
    currentUserText: string,
    currentMessages: Message[]
  ) => {
    const historyMessages = currentMessages
      .filter(message => {
        if (!message.text?.trim()) return false;
        if (message.type === 'system') return false;

        return message.role === 'user' || message.role === 'ai';
      })
      .slice(-AI_CONTEXT_MESSAGE_LIMIT);

    const historyText = historyMessages
      .map(message => {
        const roleLabel = message.role === 'user' ? 'User' : 'AI';

        return `${roleLabel}: ${message.text.trim()}`;
      })
      .join('\n');

    return `
You are Biilang, an English speaking practice partner.

Rules:
- Reply naturally in English.
- Keep the answer short and easy to speak.
- Correct the user's English gently if needed.
- Continue the conversation based on recent chat history.

Recent conversation:
${historyText || 'No previous conversation.'}

User: ${currentUserText}
AI:
`.trim();
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

  const replaceMessageText = (
    messageId: string,
    text: string,
    type?: Message['type']
  ) => {
    setMessages(prev =>
      prev.map(message =>
        message.id === messageId
          ? {
              ...message,
              text,
              type: type || message.type,
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

  const stopCurrentPlayback = async () => {
    try {
      if (playingSoundRef.current) {
        await playingSoundRef.current.stopAsync();
        await playingSoundRef.current.unloadAsync();
        playingSoundRef.current = null;
      }
    } catch (error) {
      console.error('[AI_TALK_STOP_PLAYBACK_ERROR]', error);
    } finally {
      setIsPlayingVoice(false);
    }
  };

  const stopAiSpeech = async () => {
    try {
      await Speech.stop();
    } catch (error) {
      console.error('[AI_TALK_STOP_SPEECH_ERROR]', error);
    }
  };

  const speakAiText = async (text: string) => {
    const cleanText = String(text || '').trim();

    if (!cleanText) return;

    try {
      await stopCurrentPlayback();
      await stopAiSpeech();

      Speech.speak(cleanText, {
        language: 'en-US',
        rate: 0.9,
        pitch: 1.0,
        onError: error => {
          console.error('[AI_TALK_SPEECH_ERROR]', error);
        },
      });
    } catch (error) {
      console.error('[AI_TALK_SPEAK_AI_TEXT_ERROR]', error);
    }
  };

  const playUserVoice = async (voiceUri?: string) => {
    if (!voiceUri) return;

    try {
      await stopAiSpeech();
      await stopCurrentPlayback();

      const fileInfo = await FileSystem.getInfoAsync(voiceUri);

      if (!fileInfo.exists) {
        return;
      }

      setIsPlayingVoice(true);

      const { sound } = await Audio.Sound.createAsync(
        {
          uri: voiceUri,
        },
        {
          shouldPlay: true,
        }
      );

      playingSoundRef.current = sound;

      sound.setOnPlaybackStatusUpdate(async status => {
        if (!status.isLoaded) return;

        if (status.didJustFinish) {
          await stopCurrentPlayback();
        }
      });
    } catch (error) {
      console.error('[AI_TALK_PLAY_USER_VOICE_ERROR]', error);
      setIsPlayingVoice(false);
    }
  };

  const handleMessagePress = async (message: Message) => {
    if (message.role === 'ai') {
      if (message.type === 'system') return;

      await speakAiText(message.text);
      return;
    }

    if (message.role === 'user' && message.voiceUri) {
      await playUserVoice(message.voiceUri);
    }
  };

  const saveVoiceUri = async (sourceUri: string) => {
    const voiceDir = `${FileSystem.documentDirectory || ''}ai-talk-voices/`;

    try {
      const dirInfo = await FileSystem.getInfoAsync(voiceDir);

      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(voiceDir, {
          intermediates: true,
        });
      }

      const extension = sourceUri.split('.').pop() || 'm4a';

      const fileName = `voice_${Date.now()}_${Math.random()
        .toString(16)
        .slice(2)}.${extension}`;

      const targetUri = `${voiceDir}${fileName}`;

      await FileSystem.copyAsync({
        from: sourceUri,
        to: targetUri,
      });

      savedVoiceUrisRef.current = [
        ...savedVoiceUrisRef.current,
        targetUri,
      ];

      while (savedVoiceUrisRef.current.length > MAX_SAVED_VOICES) {
        const oldVoiceUri = savedVoiceUrisRef.current.shift();

        if (oldVoiceUri) {
          try {
            await FileSystem.deleteAsync(oldVoiceUri, {
              idempotent: true,
            });
          } catch (deleteError) {
            console.error('[AI_TALK_DELETE_OLD_VOICE_ERROR]', deleteError);
          }
        }
      }

      return targetUri;
    } catch (error) {
      console.error('[AI_TALK_SAVE_VOICE_URI_ERROR]', error);

      /**
       * Nếu copy lỗi thì vẫn trả uri gốc để có thể phát lại trong session hiện tại.
       */
      return sourceUri;
    }
  };

  const transcribeVoiceToText = async (_voiceUri: string) => {
    /**
     * Hiện tại chưa có speech-to-text.
     *
     * Sau này nối whisper.rn hoặc API STT ở đây.
     * Function này phải return text thật từ voice.
     *
     * Khi return text khác rỗng:
     * voice -> text -> gửi text vào model -> AI trả lời.
     */
    return '';
  };

  const sendToLocalAi = async (
    text: string,
    baseMessages?: Message[]
  ) => {
    const thinkingMessage = createMessage('ai', 'Thinking...', 'system');

    appendMessages([thinkingMessage]);
    setIsAiThinking(true);

    try {
      const aiPrompt = buildAiPromptWithHistory(
        text,
        baseMessages || messages
      );

      const reply = await generateLocalAiReply(aiPrompt);
      const cleanReply = reply || 'Can you tell me more?';

      /**
       * Quan trọng:
       * Sau khi AI trả lời thì đổi type từ system sang text.
       * Nếu không đổi, message AI sẽ bị disable và bấm không đọc được.
       */
      replaceMessageText(thinkingMessage.id, cleanReply, 'text');

      await speakAiText(cleanReply);
    } catch (error) {
      console.error('[AI_TALK_GENERATE_REPLY_ERROR]', error);

      const errorText =
        'Sorry, I could not load the local AI model. Please check the model file in Settings and try again.';

      replaceMessageText(thinkingMessage.id, errorText, 'text');
      await speakAiText(errorText);
    } finally {
      setIsAiThinking(false);
    }
  };

  const sendTextMessage = async () => {
    const text = inputText.trim();

    if (!text || isAiThinking || isRecording) return;

    const userMessage = createMessage('user', text);
    const nextMessages = [...messages, userMessage];

    setInputText('');
    appendMessages([userMessage]);

    await sendToLocalAi(text, nextMessages);
  };

  const startRecording = async () => {
    try {
      if (isAiThinking) return;

      await stopAiSpeech();
      await stopCurrentPlayback();

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
      console.error('[AI_TALK_START_RECORDING_ERROR]', error);
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

      if (!uri) {
        return;
      }

      const savedVoiceUri = await saveVoiceUri(uri);

      /**
       * Hiện tại chưa có STT nên transcribedText sẽ rỗng.
       * Sau này có STT thì text thật sẽ được gửi vào model.
       */
      const transcribedText = await transcribeVoiceToText(savedVoiceUri);

      const userVoiceText = transcribedText
        ? transcribedText
        : 'Voice message';

      const userVoiceMessage = createMessage(
        'user',
        userVoiceText,
        'voice',
        savedVoiceUri
      );

      const nextMessages = [...messages, userVoiceMessage];

      appendMessages([userVoiceMessage]);

      /**
       * Chỉ gửi vào AI khi đã tách được text thật từ voice.
       * Hiện tại chưa có STT nên chỉ lưu voice, chưa gửi model.
       */
      if (transcribedText) {
        await sendToLocalAi(transcribedText, nextMessages);
      }
    } catch (error) {
      console.error('[AI_TALK_STOP_RECORDING_ERROR]', error);
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
      await stopAiSpeech();
      await stopCurrentPlayback();

      if (recording) {
        await recording.stopAndUnloadAsync();
      }
    } catch (error) {
      console.error('[AI_TALK_CLEAR_RECORDING_ERROR]', error);
    }

    setRecording(null);
    setIsRecording(false);
    setIsAiThinking(false);
    setIsPlayingVoice(false);
    setMessages(createInitialMessages());
    setInputText('');

    setTimeout(() => {
      scrollToBottom(false);
    }, 80);
  };

  const openSettings = async () => {
    try {
      await stopAiSpeech();
      await stopCurrentPlayback();

      if (recording) {
        await recording.stopAndUnloadAsync();
      }
    } catch (error) {
      console.error('[AI_TALK_OPEN_SETTINGS_RECORDING_ERROR]', error);
    }

    setRecording(null);
    setIsRecording(false);
    setIsAiThinking(false);
    setIsPlayingVoice(false);
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
          <Text style={styles.title}>AI Talk</Text>
          <Text style={styles.subtitle}>
            {isAiThinking
              ? 'AI is thinking...'
              : isRecording
                ? 'Recording...'
                : isPlayingVoice
                  ? 'Playing voice...'
                  : 'Practice speaking with AI'}
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
                <Pressable
                  onPress={() => handleMessagePress(message)}
                  disabled={
                    isSystem ||
                    (message.role === 'user' && !message.voiceUri)
                  }
                  style={[
                    styles.messageBubble,
                    isUser ? styles.userBubble : styles.aiBubble,
                    isSystem && styles.systemBubble,
                    message.role === 'ai' && !isSystem && styles.pressableBubble,
                    message.voiceUri && styles.pressableBubble,
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

                    {message.role === 'ai' && !isSystem && (
                      <Text style={styles.messageMeta}>Tap to speak</Text>
                    )}

                    {message.voiceUri && (
                      <Text
                        style={[
                          styles.messageMeta,
                          isUser && styles.userMessageMeta,
                        ]}
                      >
                        Tap to play
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
                </Pressable>
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

  pressableBubble: {
    opacity: 1,
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
    flexWrap: 'wrap',
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
